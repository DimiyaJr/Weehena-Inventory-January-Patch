// src/components/OnDemandPaymentStatusModal.tsx
import React from 'react';
import { X, DollarSign, Wallet, Truck } from 'lucide-react';

interface OnDemandPaymentStatusModalProps {
  onClose: () => void;
  onSelectPaymentStatus: (status: 'full' | 'partial' | 'no_payment') => void;
  totalAmount: number;
}

export const OnDemandPaymentStatusModal: React.FC<OnDemandPaymentStatusModalProps> = ({
  onClose,
  onSelectPaymentStatus,
  totalAmount,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Select Payment Status</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => onSelectPaymentStatus('full')}
            className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold"
          >
            <DollarSign className="w-6 h-6 mr-3" />
            Full Payment ({totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'LKR' })})
          </button>
          <button
            onClick={() => onSelectPaymentStatus('partial')}
            className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
          >
            <Wallet className="w-6 h-6 mr-3" />
            Partial Payment
          </button>
          <button
            onClick={() => onSelectPaymentStatus('no_payment')}
            className="w-full flex items-center justify-center px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-lg font-semibold"
          >
            <Truck className="w-6 h-6 mr-3" />
            Delivered - No Payment Collected
          </button>
        </div>

        <div className="mt-6 text-center">
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
