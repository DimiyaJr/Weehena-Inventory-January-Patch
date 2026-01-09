// src/utils/formatters.ts

export const formatCurrency = (amount: number): string => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 'Rs. 0.00'; // Handle non-numeric or NaN inputs gracefully
  }
  return `Rs. ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};
