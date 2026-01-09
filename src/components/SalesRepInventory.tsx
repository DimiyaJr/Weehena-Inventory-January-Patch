// src/components/SalesRepInventory.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Search, Package, AlertTriangle, ShoppingCart, User, RotateCcw, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { WEIGHT_UNIT, GRAMS_PER_KG } from '../utils/units';
import { CreateOnDemandSaleModal } from './CreateOnDemandSaleModal';

// Define a flexible interface for products displayed in the Sales Rep Inventory component
interface AssignedProduct {
  id: string; // on_demand_assignment_item.id
  product_id: string; // actual product.id
  product_display_id?: string; // actual product.product_id
  name: string; // product.name
  category_name?: string; // product.categories.category_name
  sku?: string; // product.sku
  unit_type: 'Kg' | 'g' | 'Packs'; // product.unit_type
  weight_per_pack_kg?: number | null; // product.weight_per_pack_kg
  grams_per_unit?: number | null; // product.grams_per_unit

  assigned_quantity: number; // from on_demand_assignment_items
  sold_quantity: number; // from on_demand_assignment_items
  returned_quantity: number; // from on_demand_assignment_items
  remaining_quantity: number; // calculated
  on_demand_assignment_id: string; // The ID of the parent assignment
  assignment_status: 'active' | 'completed' | 'cancelled'; // Status of the parent assignment
  assignment_date: string; // Date of the parent assignment
  vehicle_number?: string | null; // Vehicle number from parent assignment
  sales_rep_id: string; // ADD THIS LINE - to track which rep owns this

  // NEW: Add price fields
  price_cash?: number;
  price_credit?: number;
  price_dealer_cash?: number;
  price_dealer_credit?: number;
  price_hotel_non_vat?: number;
  price_hotel_vat?: number;
  price_farm_shop?: number;
  assignment_item_ids?: string[]; // NEW: Track all assignment item IDs for consolidated items
}

// Placeholder for Self-Assign Products Modal
const SelfAssignProductsModal: React.FC<{ onClose: () => void; onProductsAssigned: () => void }> = ({ onClose, onProductsAssigned }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
        <h2 className="text-xl font-bold mb-4">Self-Assign Products</h2>
        <p>This is a placeholder for the self-assignment logic.</p>
        <div className="flex justify-end space-x-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
          <button onClick={() => { alert('Self-assignment logic to be implemented!'); onClose(); onProductsAssigned(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Assign</button>
        </div>
      </div>
    </div>
  );
};

export const SalesRepInventory: React.FC = () => {
  const { user, isOnline } = useAuth();
  const [assignedProducts, setAssignedProducts] = useState<AssignedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSelfAssignModal, setShowSelfAssignModal] = useState(false);
  const [showCreateSaleModal, setShowCreateSaleModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedProductForReturn, setSelectedProductForReturn] = useState<AssignedProduct | null>(null);
  const [returnQuantity, setReturnQuantity] = useState(0);
  const [returningInProgress, setReturningInProgress] = useState(false);

  useEffect(() => {
    if (user?.role === 'Sales Rep') {
      fetchAssignedProducts();
    }
  }, [user, isOnline]);

  const fetchAssignedProducts = async () => {
    setLoading(true);
    setError(null);
    const cacheKey = `sales_rep_assigned_products_${user?.id}`;

    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        setAssignedProducts(JSON.parse(cachedData));
        setLoading(false);
        return;
      }
    }

    try {
      console.log('SalesRepInventory: Fetching assigned products for Sales Rep...');
      const { data, error } = await supabase
        .from('on_demand_assignment_items')
        .select(`
          id,
          assigned_quantity,
          sold_quantity,
          returned_quantity,
          product_id,
          on_demand_assignments(id, sales_rep_id, status, assignment_date, vehicle_number),
          products(
            id,
            product_id,
            name,
            sku,
            unit_type,
            weight_per_pack_kg,
            grams_per_unit,
            categories(category_name),
            price_cash,
            price_credit,
            price_dealer_cash,
            price_dealer_credit,
            price_hotel_non_vat,
            price_hotel_vat,
            price_farm_shop
          )
        `)
        .eq('on_demand_assignments.sales_rep_id', user?.id)
        .eq('on_demand_assignments.status', 'active')
        .order('name', { foreignTable: 'products', ascending: true });

      if (error) throw error;

      // SECURITY: Filter items again at application level to ensure no data leakage from cache
      const filteredData = (data || []).filter(item => 
        item.on_demand_assignments?.sales_rep_id === user?.id
      );

      // NEW: Consolidate by product_id
      const consolidatedMap = new Map<string, any>();
      
      filteredData.forEach(item => {
        const productId = item.products?.id || '';
        const remaining = item.assigned_quantity - item.sold_quantity - item.returned_quantity;
        
        if (remaining <= 0) return; // Skip items with no remaining quantity
        
        if (consolidatedMap.has(productId)) {
          // Add to existing consolidated item
          const existing = consolidatedMap.get(productId);
          existing.assigned_quantity += item.assigned_quantity;
          existing.sold_quantity += item.sold_quantity;
          existing.returned_quantity += item.returned_quantity;
          existing.remaining_quantity += remaining;
          existing.assignment_item_ids.push(item.id); // Track all assignment item IDs
        } else {
          // Create new consolidated item
          consolidatedMap.set(productId, {
            id: item.id, // Use first item's ID as reference
            product_id: productId,
            product_display_id: item.products?.product_id,
            name: item.products?.name || 'Unknown Product',
            category_name: item.products?.categories?.category_name || 'N/A',
            sku: item.products?.sku,
            unit_type: item.products?.unit_type || 'Kg',
            weight_per_pack_kg: item.products?.weight_per_pack_kg,
            grams_per_unit: item.products?.grams_per_unit,
            assigned_quantity: item.assigned_quantity,
            sold_quantity: item.sold_quantity,
            returned_quantity: item.returned_quantity,
            remaining_quantity: remaining,
            on_demand_assignment_id: item.on_demand_assignments?.id || '',
            assignment_status: item.on_demand_assignments?.status || 'active',
            assignment_date: item.on_demand_assignments?.assignment_date || '',
            vehicle_number: item.on_demand_assignments?.vehicle_number,
            sales_rep_id: item.on_demand_assignments?.sales_rep_id || '',
            price_cash: item.products?.price_cash,
            price_credit: item.products?.price_credit,
            price_dealer_cash: item.products?.price_dealer_cash,
            price_dealer_credit: item.products?.price_dealer_credit,
            price_hotel_non_vat: item.products?.price_hotel_non_vat,
            price_hotel_vat: item.products?.price_hotel_vat,
            price_farm_shop: item.products?.price_farm_shop,
            assignment_item_ids: [item.id], // NEW: Track all assignment item IDs for this product
          });
        }
      });

      const processedData: AssignedProduct[] = Array.from(consolidatedMap.values());

      localStorage.setItem(cacheKey, JSON.stringify(processedData));
      setAssignedProducts(processedData);
    } catch (err: any) {
      console.error('SalesRepInventory: Error fetching assigned products:', err);
      setError('Failed to load assigned products. Please check your database connection.');
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        setAssignedProducts(JSON.parse(cachedData));
      } else {
        setAssignedProducts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReturnClick = (product: AssignedProduct) => {
    setSelectedProductForReturn(product);
    setReturnQuantity(product.remaining_quantity);
    setShowReturnModal(true);
  };

  const handleConfirmReturn = async () => {
    if (!selectedProductForReturn || !user) {
      alert('Invalid return request');
      return;
    }

    if (returnQuantity <= 0 || returnQuantity > selectedProductForReturn.remaining_quantity) {
      alert(`Please enter a valid return quantity between 0 and ${selectedProductForReturn.remaining_quantity}`);
      return;
    }

    if (!confirm(`Are you sure you want to return ${returnQuantity} ${WEIGHT_UNIT} of ${selectedProductForReturn.name}? This will be added back to the main inventory.`)) {
      return;
    }

    console.log('Starting return process:', {
      productName: selectedProductForReturn?.name,
      returnQuantity,
      assignmentItemIds: selectedProductForReturn?.assignment_item_ids,
      userId: user?.id
    });

    setReturningInProgress(true);
    
    try {
      // Get all assignment item IDs for this product
      const assignmentItemIds = selectedProductForReturn.assignment_item_ids || [selectedProductForReturn.id];
      
      // Calculate how much to return from each assignment item
      let remainingToReturn = returnQuantity;
      let totalReturned = 0;
      const errors: string[] = [];
      
      for (const itemId of assignmentItemIds) {
        if (remainingToReturn <= 0) break;
        
        // Get current item details
        const { data: itemData, error: itemError } = await supabase
          .from('on_demand_assignment_items')
          .select('assigned_quantity, sold_quantity, returned_quantity')
          .eq('id', itemId)
          .single();
        
        if (itemError) {
          console.error('Error fetching item data:', itemError);
          errors.push(`Failed to fetch data for item ${itemId}`);
          continue;
        }
        
        const itemRemaining = itemData.assigned_quantity - itemData.sold_quantity - itemData.returned_quantity;
        const toReturnFromThisItem = Math.min(remainingToReturn, itemRemaining);
        
        if (toReturnFromThisItem > 0) {
          // Call the supabase function to handle the return
          const { data: returnResult, error: returnError } = await supabase
            .rpc('return_on_demand_product', {
              p_assignment_item_id: itemId,
              p_return_quantity: toReturnFromThisItem
            });
          
          if (returnError) {
            console.error('Error returning product:', returnError);
            errors.push(`Failed to return ${toReturnFromThisItem} ${WEIGHT_UNIT} from item ${itemId}: ${returnError.message}`);
            continue;
          }
          
          // Check if the function returned an error in its result
          if (returnResult && !returnResult.success) {
            console.error('Function returned error:', returnResult.error);
            errors.push(`Failed to return ${toReturnFromThisItem} ${WEIGHT_UNIT}: ${returnResult.error}`);
            continue;
          }
          
          console.log('Successfully returned:', returnResult);
          totalReturned += toReturnFromThisItem;
          remainingToReturn -= toReturnFromThisItem;
        }
      }
      
      // Show results
      if (errors.length > 0) {
        if (totalReturned > 0) {
          alert(`Partially returned ${totalReturned} ${WEIGHT_UNIT} of ${selectedProductForReturn.name}. Some items failed:\n\n${errors.join('\n')}`);
        } else {
          alert(`Failed to return products:\n\n${errors.join('\n')}`);
        }
      } else if (totalReturned > 0) {
        alert(`Successfully returned ${totalReturned} ${WEIGHT_UNIT} of ${selectedProductForReturn.name} to main inventory!`);
      }
      
      // Always close modal and refresh, even if partial success
      if (totalReturned > 0) {
        setShowReturnModal(false);
        setSelectedProductForReturn(null);
        setReturnQuantity(0);
        fetchAssignedProducts(); // Refresh the inventory
      }
    } catch (err: any) {
      console.error('Error in return process:', err);
      alert(`Failed to return product: ${err.message || 'Unknown error occurred'}`);
    } finally {
      setReturningInProgress(false);
    }
  };

  const filteredProducts = assignedProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.product_display_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && assignedProducts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading your assigned products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">My Assigned Inventory</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateSaleModal(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Create On-Demand Sale
          </button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search assigned products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {filteredProducts.length === 0 && !loading ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assigned products found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'No products match your search criteria.' : 'You currently have no active products assigned for on-demand sales.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
         {/* Mobile Card Layout */}
          <div className="block md:hidden">
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {product.name}
                      </h3>
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Product ID: {product.product_display_id || 'N/A'}</span>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Category: {product.category_name || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Assigned:</span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {product.assigned_quantity} {WEIGHT_UNIT}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Sold:</span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {product.sold_quantity} {WEIGHT_UNIT}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Returned:</span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {product.returned_quantity} {WEIGHT_UNIT}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Remaining:</span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          product.remaining_quantity <= 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {product.remaining_quantity} {WEIGHT_UNIT}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Vehicle:</span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {product.vehicle_number || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handleReturnClick(product)}
                      className="w-full flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                      disabled={product.remaining_quantity <= 0}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Return to Inventory
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned ({WEIGHT_UNIT})
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sold ({WEIGHT_UNIT})
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Returned ({WEIGHT_UNIT})
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remaining ({WEIGHT_UNIT})
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assignment Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product, index) => (
                    <tr key={product.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.product_display_id || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="w-5 h-5 text-blue-600 mr-2" />
                          {product.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.category_name || 'Uncategorized'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {product.assigned_quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {product.sold_quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {product.returned_quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <span className={`font-medium ${
                          product.remaining_quantity <= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {product.remaining_quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(product.assignment_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.vehicle_number || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleReturnClick(product)}
                          className="inline-flex items-center px-3 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={product.remaining_quantity <= 0}
                          title="Return unused inventory to main stock"
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showSelfAssignModal && (
        <SelfAssignProductsModal
          onClose={() => setShowSelfAssignModal(false)}
          onProductsAssigned={fetchAssignedProducts}
        />
      )}

      {showCreateSaleModal && (
        <CreateOnDemandSaleModal
          onClose={() => setShowCreateSaleModal(false)}
          onSaleCreated={fetchAssignedProducts}
          assignedProducts={assignedProducts}
        />
      )}

      {/* Return Modal */}
      {showReturnModal && selectedProductForReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Return Inventory</h2>
                <button
                  onClick={() => {
                    setShowReturnModal(false);
                    setSelectedProductForReturn(null);
                    setReturnQuantity(0);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Package className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {selectedProductForReturn.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Category: {selectedProductForReturn.category_name || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Assigned:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedProductForReturn.assigned_quantity} {WEIGHT_UNIT}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Sold:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedProductForReturn.sold_quantity} {WEIGHT_UNIT}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Already Returned:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedProductForReturn.returned_quantity} {WEIGHT_UNIT}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-green-50 rounded-lg px-3">
                    <span className="text-sm font-semibold text-gray-900">Available to Return:</span>
                    <span className="text-sm font-bold text-green-700">
                      {selectedProductForReturn.remaining_quantity} {WEIGHT_UNIT}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity to Return ({WEIGHT_UNIT}) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={returnQuantity}
                    onChange={(e) => setReturnQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                    max={selectedProductForReturn.remaining_quantity}
                    placeholder="Enter quantity to return"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum: {selectedProductForReturn.remaining_quantity} {WEIGHT_UNIT}
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>Note:</strong> Returned inventory will be added back to the main stock and will no longer be available in your inventory.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowReturnModal(false);
                    setSelectedProductForReturn(null);
                    setReturnQuantity(0);
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={returningInProgress}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  disabled={returningInProgress || returnQuantity <= 0 || returnQuantity > selectedProductForReturn.remaining_quantity}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {returningInProgress ? (
                    'Returning...'
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Confirm Return
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};