// src/components/SecurityCheckModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Package } from 'lucide-react';
import { Order, OrderItem } from '../lib/supabase';
import { WEIGHT_UNIT, GRAMS_PER_KG } from '../utils/units'; // UPDATED IMPORT

interface SecurityCheckModalProps {
  order: Order & { order_items: (OrderItem & { products: { name: string; unit_type: string; weight_per_pack_kg?: number | null } })[] };
  onClose: () => void;
  onConfirm: (orderId: string, updatedQuantities: { itemId: string; actualQuantity: number }[], notes: string) => Promise<void>;
  loading: boolean;
}

export const SecurityCheckModal: React.FC<SecurityCheckModalProps> = ({
  order,
  onClose,
  onConfirm,
  loading,
}) => {
  const [actualTotalQuantityInput, setActualTotalQuantityInput] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [totalSuggestedQuantity, setTotalSuggestedQuantity] = useState<number>(0);
  const [commonUnitType, setCommonUnitType] = useState<string>('Units');
  const [actualQuantityDifferenceError, setActualQuantityDifferenceError] = useState<string | null>(null);

  const validateActualQuantity = (actualQty: number, suggestedQty: number, unitType: string) => {
    if (isNaN(actualQty) || actualQty <= 0) {
      return 'Actual load weight must be a positive number.';
    }

    // Apply 30KG difference rule only if the overall unit is Kg
    if (unitType === 'Kg') {
      const difference = Math.abs(actualQty - suggestedQty);
      if (difference > 30) {
        return `Difference from suggested load weight (${suggestedQty.toFixed(2)} Kg) exceeds 30 Kg.`;
      }
    }
    return null;
  };

  const handleActualTotalQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setActualTotalQuantityInput(value);

    const parsedActualTotal = parseFloat(value);
    const validationError = validateActualQuantity(parsedActualTotal, totalSuggestedQuantity, commonUnitType);
    setActualQuantityDifferenceError(validationError);
  };

  useEffect(() => {
    // Calculate total suggested quantity and determine common unit type
    let sumQuantity = 0;
    let firstUnitType: string | null = null;
    let allSameUnit = true; // Checks if all items have the same unit_type
    let allPacksHaveWeight = true; // Checks if all 'Packs' items have weight_per_pack_kg
    let allGramsHaveWeight = true; // NEW VARIABLE

    order.order_items.forEach(item => {
      if (item.products.unit_type === 'Packs' && item.products.weight_per_pack_kg !== null) {
        sumQuantity += item.quantity * item.products.weight_per_pack_kg; // Convert packs to Kg
      } else if (item.products.unit_type === 'g' && item.products.grams_per_unit !== null) { // NEW CONVERSION
        sumQuantity += item.quantity * (item.products.grams_per_unit / GRAMS_PER_KG); // Convert grams units to Kg
      } else {
        sumQuantity += item.quantity; // Use quantity as is (Kg, or Packs/g without conversion factors)
        if (item.products.unit_type === 'Packs') {
          allPacksHaveWeight = false;
        } else if (item.products.unit_type === 'g') { // NEW CHECK
          allGramsHaveWeight = false;
        }
      }
      
      if (firstUnitType === null) {
        firstUnitType = item.products.unit_type;
      } else if (firstUnitType !== item.products.unit_type) {
        allSameUnit = false;
      }
    });
    
    setTotalSuggestedQuantity(sumQuantity);
    
    // Determine common unit type
    let determinedCommonUnitType = 'Units';
    if ((allSameUnit && firstUnitType === 'Packs' && allPacksHaveWeight) || 
        (allSameUnit && firstUnitType === 'g' && allGramsHaveWeight) || // NEW CONDITION
        (allSameUnit && firstUnitType === 'Kg')) {
      determinedCommonUnitType = 'Kg';
    } else if (allSameUnit && firstUnitType) {
      determinedCommonUnitType = firstUnitType;
    }
    
    setCommonUnitType(determinedCommonUnitType);
    
    // Initialize actualTotalQuantityInput with the sum of actual_quantity_after_security_check if available,
    // otherwise with the sum of original quantities.
    const initialActualSum = order.order_items.reduce((sum, item) => 
      sum + (item.actual_quantity_after_security_check ?? item.quantity), 0
    );
    setActualTotalQuantityInput(initialActualSum.toString());

    // Initialize notes based on order status
    // For reloaded orders, start with empty notes for fresh verification
    if (order.status === 'Product Reloaded') {
      setNotes('');
    } else {
      // For first-time checks, use existing notes if any
      setNotes(order.security_check_notes || '');
    }

    // Validate initial actual quantity using the determined commonUnitType
    const initialActualQty = parseFloat(initialActualSum.toString());
    const initialError = validateActualQuantity(initialActualQty, sumQuantity, determinedCommonUnitType);
    setActualQuantityDifferenceError(initialError);
  }, [order]);

  const handleSubmit = async () => {
    setError(null); // Clear general error

    // Ensure the latest validation state is used
    const parsedActualTotal = parseFloat(actualTotalQuantityInput);
    const currentValidationError = validateActualQuantity(parsedActualTotal, totalSuggestedQuantity, commonUnitType);

    if (currentValidationError) {
      setActualQuantityDifferenceError(currentValidationError); // Make sure it's visible
      setError('Please correct the actual load weight before confirming.');
      return;
    }

    // If no specific quantity difference error, clear any previous general error
    setActualQuantityDifferenceError(null);

    if (totalSuggestedQuantity === 0) {
      setError('Cannot update quantities for an order with no products.');
      return;
    }

    const adjustmentRatio = parsedActualTotal / totalSuggestedQuantity;
    const updatedQuantities = order.order_items.map(item => ({
      itemId: item.id,
      actualQuantity: item.quantity * adjustmentRatio, // Proportional distribution
    }));

    try {
      await onConfirm(order.id, updatedQuantities, notes);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm security check.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Security Check: Weight Verification</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-gray-700 mb-4">
          Order ID: <span className="font-medium">{order.order_display_id}</span>
        </p>

        <div className="space-y-4 mb-6">
          {order.order_items.map(item => (
            <div key={item.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-between">
              <div className="flex items-center">
                <Package className="w-5 h-5 text-blue-600 mr-2" />
                <span className="font-semibold text-gray-900">{item.products.name}</span>
              </div>
              <p className="text-sm text-gray-600 ml-4">
                Original Quantity: <span className="font-medium text-gray-800">{item.quantity} {item.products.unit_type}</span>
                {item.products.unit_type === 'Packs' && item.products.weight_per_pack_kg && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({item.products.weight_per_pack_kg} Kg per pack)
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-2">Load Quantities</h3>
          <p className="text-sm text-green-700 mb-2">
            Suggested Load Weight: <span className="font-bold">{totalSuggestedQuantity.toFixed(2)} {commonUnitType}</span>
          </p>
          <div className="mb-4">
            <label htmlFor="actual-total-qty" className="block text-sm font-medium text-blue-700 mb-1">
              Actual Load Weight (Kg) *
            </label>
            <input
              id="actual-total-qty"
              type="number"
              step="0.1"
              min="0.1"
              value={actualTotalQuantityInput}
              onChange={handleActualTotalQuantityChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                actualQuantityDifferenceError ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {actualQuantityDifferenceError && (
              <p className="text-sm text-red-600 mt-1">{actualQuantityDifferenceError}</p>
            )}
            {commonUnitType === 'Packs' && (
              <p className="text-xs text-gray-500 mt-1">
                Note: Input is in Kilograms. This will be proportionally applied to original pack quantities.
                (e.g., 49 Kg for 50 Packs will result in 0.98 of each pack quantity).
              </p>
            )}
            {commonUnitType === 'Units' && (
              <p className="text-xs text-gray-500 mt-1">
                Note: Order contains mixed units. Input is in Kilograms and will be proportionally applied to original quantities.
              </p>
            )}
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="security-notes" className="block text-sm font-medium text-gray-700 mb-1">
            Security Check Notes (Optional)
          </label>
          <textarea
            id="security-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="Add any notes regarding the security check..."
          ></textarea>
        </div>

        {error && (
          <div className="flex items-center p-3 mb-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div className="flex space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            disabled={loading || actualQuantityDifferenceError !== null}
          >
            {loading ? (
              'Confirming...'
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Confirm Security Check
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};