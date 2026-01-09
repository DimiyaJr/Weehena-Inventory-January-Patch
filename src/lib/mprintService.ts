import html2pdf from 'html2pdf.js';

export interface MprintBillData {
  billHtml: string;
  fileName: string;
  customerName: string;
  receiptNo: string;
}

/**
 * Converts bill HTML to PDF and prepares for mPrint
 * Improved mobile-specific rendering with proper visibility and sizing
 */
export const generateBillPDF = async (billHtml: string, fileName: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Validate HTML content before processing
    if (!billHtml || billHtml.trim().length < 100) {
      reject(new Error('Invalid or empty bill HTML provided'));
      return;
    }

    // Detect device type
    const isAndroid = /android/i.test(navigator.userAgent.toLowerCase());
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
    const isMobileDevice = isAndroid || isIOS;

    // Create a temporary container
    const element = document.createElement('div');
    element.innerHTML = billHtml;
    
    // Mobile-specific styling for proper rendering
    const baseStyles = {
      width: '80mm',
      maxWidth: '80mm',
      minWidth: '80mm',  // ADDED: Strict 80mm width
      margin: '0',
      padding: '0',
      backgroundColor: 'white',
      position: 'fixed',
      top: '0',
      left: '0', 
      bottom: 'auto',
      zIndex: '-1',
      visibility: 'visible' as const,
      opacity: '1',
      pointerEvents: 'none' as const,
      overflow: 'hidden',  // ADDED: Prevent overflow
      boxSizing: 'border-box'  // ADDED: Include padding/borders in width
    };

    Object.assign(element.style, baseStyles);
    
    document.body.appendChild(element);

    // Ensure content is rendered before PDF generation
    setTimeout(async () => {
      try {
        const contentHeight = element.scrollHeight;
        const heightInMm = (contentHeight * 0.264583) + 5;  // Add small margin, remove Math.max

        // Use fixed dimensions for consistent 80mm output across all devices
        const targetWidthPx = 302;  // 80mm at 96 DPI
        const calculatedScale = 2.0;  // CHANGED: Consistent scale for both mobile and desktop

        const options = {
          margin: [0, 0, 0, 0],  // NO margins - the HTML has internal padding
          filename: `${fileName}.pdf`,
          image: { 
            type: 'png',
            quality: 0.95
          },
          html2canvas: { 
            scale: calculatedScale,
            useCORS: true,
            logging: false,
            letterRendering: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            windowWidth: 302,  // CHANGED: Fixed to 80mm pixel equivalent
            windowHeight: contentHeight + 10, 
            width: 302,  // CHANGED: Fixed to 80mm pixel equivalent
            height: contentHeight + 10,
            scrollY: 0,
            scrollX: 0,
            y: 0,
            x: 0,
            ignoreElements: (element: any) => {
              const style = window.getComputedStyle(element);
              return style.display === 'none' || style.visibility === 'hidden';
            }
          },
          jsPDF: { 
            orientation: 'portrait' as const, 
            unit: 'mm' as const, 
            format: [80, heightInMm],
            compress: false
          },
          pagebreak: { 
            mode: ['avoid-all', 'css', 'legacy'] as const,
            before: '.page-break-before',
            after: '.page-break-after',
            avoid: ['tr', '.no-break', '.item-row', '.payment-summary', '.totals']
          }
        };

        console.log('[PDF Generation] Config:', {
          device: isMobileDevice ? 'mobile' : 'desktop',
          scale: calculatedScale,
          contentHeight,
          heightInMm,
          targetWidthPx
        });

        html2pdf()
          .set(options)
          .from(element)
          .outputPdf('blob')
          .then((pdf: Blob) => {
            console.log('[PDF Generation] Success - Blob size:', pdf.size, 'bytes');
            
            // Verify PDF is not blank
            if (pdf.size < 5000) {
              console.warn('[PDF Generation] Warning: PDF size very small, may be blank');
            }
            
            document.body.removeChild(element);
            resolve(pdf);
          })
          .catch((error: any) => {
            console.error('[PDF Generation] Error:', error.name, error.message);
            document.body.removeChild(element);
            reject(error);
          });
      } catch (error) {
        console.error('[PDF Generation] Unexpected error:', error);
        if (document.body.contains(element)) {
          document.body.removeChild(element);
        }
        reject(error);
      }
    }, 500);  // Give browser time to render element
  });
};

/**
 * Validates and prepares HTML content for PDF generation
 * Ensures critical sections exist and content is not empty
 */
export const validateAndPrepareHTML = (billHtml: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!billHtml || billHtml.trim().length === 0) {
    errors.push('HTML string is empty');
  }

  const hasHeader = billHtml.includes('WEEHENA') || billHtml.includes('header');
  if (!hasHeader) {
    errors.push('Missing header section');
  }

  const hasItems = billHtml.includes('ORDER ITEMS') || billHtml.includes('item');
  if (!hasItems) {
    errors.push('Missing items section');
  }

  const hasFooter = billHtml.includes('footer') || billHtml.includes('Thank you');
  if (!hasFooter) {
    errors.push('Missing footer section');
  }

  const hasBody = billHtml.includes('<body') && billHtml.includes('</body>');
  if (!hasBody) {
    errors.push('Invalid HTML structure - missing body tags');
  }

  if (billHtml.length < 500) {
    errors.push('HTML content too short - likely incomplete');
  }

  const isValid = errors.length === 0;
  
  if (!isValid) {
    console.warn('[HTML Validation] Errors found:', errors);
  } else {
    console.log('[HTML Validation] HTML valid - Length:', billHtml.length, 'bytes');
  }

  return { isValid, errors };
};

/**
 * Validates if generated PDF is not blank
 * Returns true if PDF appears to have content
 */
export const validatePDFBlob = (pdfBlob: Blob): { isValid: boolean; sizeKb: number; reason?: string } => {
  const sizeKb = pdfBlob.size / 1024;
  
  // PDFs below 8KB are likely blank/corrupted
  if (sizeKb < 8) {
    return { 
      isValid: false, 
      sizeKb, 
      reason: 'PDF too small - likely blank or corrupted'
    };
  }

  // PDFs over 10MB are likely corrupted
  if (sizeKb > 10240) {
    return { 
      isValid: false, 
      sizeKb, 
      reason: 'PDF too large - likely corrupted'
    };
  }

  return { isValid: true, sizeKb };
};

/**
 * Opens mPrint app via deep link or share intent
 */
export const redirectToMprint = async (pdfBlob: Blob, fileName: string) => {
  try {
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(userAgent);

    if (isAndroid) {
      const mprintIntent = `intent://${pdfUrl}#Intent;action=android.intent.action.SEND;type=application/pdf;end`;
      window.location.href = mprintIntent;
    } else if (isIOS) {
      window.open(pdfUrl, '_blank');
    } else {
      window.open(pdfUrl, '_blank');
    }

    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 5000);

  } catch (error) {
    console.error('Error redirecting to mPrint:', error);
    throw error;
  }
};

/**
 * Save file to device for manual opening in mPrint
 */
export const downloadBillForMprint = async (pdfBlob: Blob, fileName: string) => {
  const { saveAs } = await import('file-saver');
  saveAs(pdfBlob, `${fileName}.pdf`);
};

/**
 * Generate HTML string from On-Demand Bill Layout Component data
 * This creates the HTML without rendering React to avoid database issues
 */
export const generateOnDemandBillHTML = (billData: {
  order: any;
  paymentMethod: any;
  receiptNo: string;
  transactionAmount: number;
  previouslyCollected: number;
  totalCollected: number;
  remainingBalance: number;
  paymentStatusText: string;
}): string => {
  const { 
    order, 
    paymentMethod, 
    receiptNo,
    transactionAmount,
    previouslyCollected,
    totalCollected,
    remainingBalance,
    paymentStatusText
  } = billData;

  // Import formatCurrency behavior inline for HTML generation
  const formatCurrency = (amount: number): string => {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return 'Rs. 0.00';
    }
    return `Rs. ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getTotalAmount = () => order.total_amount || 0;
  
  // Calculate VAT if applicable (18%)
  const calculateVAT = () => {
    const subtotal = getTotalAmount();
    // Check if VAT applies based on customer details
    if (order.customer_details?.vat_status === 'VAT') {
      return (subtotal * 18) / 118; // VAT amount from inclusive price
    }
    return 0;
  };
  
  const getSubtotal = () => {
    const total = getTotalAmount();
    const vat = calculateVAT();
    return total - vat;
  };

  const vatAmount = calculateVAT();
  const subtotal = getSubtotal();

  const productItemsHTML = (order.product_details || []).map((item: any, index: number) => {
    const lastItem = index === (order.product_details?.length || 0) - 1;
    
    // Safely extract product_id and sku with fallbacks
    const productId = item.products?.product_id || 
                      item.product_id || 
                      item.products?.id || 
                      'N/A';
    
    const sku = item.products?.sku || 
                item.sku || 
                'N/A';
    
    // Format the product ID display
    let productIdDisplay = 'ID: N/A';
    if (productId !== 'N/A' || sku !== 'N/A') {
      if (productId !== 'N/A' && sku !== 'N/A') {
        productIdDisplay = `ID: ${productId} (${sku})`;
      } else if (productId !== 'N/A') {
        productIdDisplay = `ID: ${productId}`;
      } else if (sku !== 'N/A') {
        productIdDisplay = `SKU: ${sku}`;
      }
    }
    
    return `
      <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: ${lastItem ? 'none' : '1px dashed #ccc'};">
        <div style="margin-bottom: 4px;">
          <p style="margin: 0; font-size: 12px; font-weight: bold;">${item.products?.name || 'Product'}</p>
          <p style="margin: 0; font-size: 10px; color: #555;">${productIdDisplay}</p>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; line-height: 1.6;">
          <span>${item.sold_quantity || 0} × ${typeof item.selling_price === 'number' ? item.selling_price.toFixed(2) : '0.00'}</span>
          <span style="font-weight: bold; text-align: right;">${formatCurrency((item.sold_quantity || 0) * (item.selling_price || 0))}</span>
        </div>
      </div>
    `;
  }).join('');

  // Determine payment method display with fallbacks
  const paymentMethodDisplay = paymentMethod?.label || 
                               paymentMethod?.value || 
                               paymentMethod || 
                               order.payment_method || 
                               'N/A';

  return `
    <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body style="font-family: 'Courier New', monospace; margin: 0; padding: 5px 3px; background: white; color: #000; font-size: 12px; line-height: 1.6; width: 80mm; box-sizing: border-box;">
      
          <div style="width: 80mm; margin: 0; padding: 0;">
            <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px;">
              <h1 style="font-size: 18px; font-weight: bold; margin: 0 0 3px 0; letter-spacing: 1px;">WEEHENA FARMS</h1>
              <p style="margin: 0; font-size: 10px; color: #333;">A Taste with Quality</p>
              <div style="background-color: #f0f0f0; padding: 6px 0; margin: 8px 0; border: 1px solid #000; border-radius: 3px; font-size: 13px; font-weight: bold; letter-spacing: 0.5px;">ON DEMAND ORDER</div>
              <h2 style="font-size: 16px; font-weight: bold; margin: 8px 0 5px 0;">SALES RECEIPT</h2>
              <p style="font-size: 11px; margin: 3px 0;">Date: ${new Date(order.sale_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
              <p style="font-size: 11px; margin: 3px 0;">Receipt No: <span style="font-weight: bold;">${receiptNo}</span></p>
            </div>
      
            <div style="margin-bottom: 15px; font-size: 11px; line-height: 1.7;">
              <p style="font-size: 12px; font-weight: bold; margin: 0 0 5px 0; border-bottom: 1px dashed #000; padding-bottom: 3px;">BILL TO:</p>
              <div style="margin: 3px 0; font-weight: bold;">${order.customer_details?.name || order.customer_name || 'N/A'}</div>
              ${order.customer_details?.address ? `<div style="margin: 3px 0;">${order.customer_details.address}</div>` : ''}
              <div style="margin: 3px 0;">Phone: ${order.customer_details?.phone_number || order.customer_phone || 'N/A'}</div>
              ${order.customer_details?.email ? `<div style="margin: 3px 0;">Email: ${order.customer_details.email}</div>` : ''}
              ${order.customer_details?.vat_status ? `<div style="margin: 3px 0;">VAT Status: ${order.customer_details.vat_status}</div>` : ''}
              ${order.customer_details?.vat_status === 'VAT' && order.customer_details?.tin_number ? `<div style="margin: 3px 0; font-weight: bold;">TIN: ${order.customer_details.tin_number}</div>` : ''}
            </div>
      
            <div style="margin-bottom: 15px; font-size: 11px; line-height: 1.7;">
              <p style="font-size: 12px; font-weight: bold; margin: 0 0 5px 0; border-bottom: 1px dashed #000; padding-bottom: 3px;">ORDER DETAILS:</p>
              <div style="margin: 3px 0;">Order ID: <span style="font-weight: bold;">${order.on_demand_order_display_id || 'N/A'}</span></div>
              <div style="margin: 3px 0;">Sales Rep: <span style="font-weight: bold;">${order.sales_rep_username || 'N/A'}</span></div>
              <div style="margin: 3px 0;">Payment Method: <span style="font-weight: bold;">${paymentMethodDisplay}</span></div>
            </div>
      
            <div style="margin-bottom: 15px;">
              <p style="font-size: 12px; font-weight: bold; margin: 0 0 8px 0; border-bottom: 2px solid #000; padding-bottom: 4px;">ORDER ITEMS:</p>
              ${productItemsHTML}
              
              <div style="margin-top: 12px; border-top: 2px solid #000; padding-top: 8px;">
                <div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 11px;">
                  <span>Subtotal:</span>
                  <span style="font-weight: bold; text-align: right;">${formatCurrency(subtotal)}</span>
                </div>
                ${vatAmount > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 11px;">
                    <span>VAT (18%):</span>
                    <span style="font-weight: bold; text-align: right;">${formatCurrency(vatAmount)}</span>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-top: 2px solid #000; border-bottom: 2px double #000; font-size: 13px; font-weight: bold;">
                  <span>GRAND TOTAL:</span>
                  <span style="font-size: 14px; text-align: right;">${formatCurrency(getTotalAmount())}</span>
                </div>
              </div>
            </div>
      
            <div style="margin-bottom: 15px; padding: 10px; background-color: #f9f9f9; border: 1px solid #ccc; border-radius: 3px;">
              <p style="font-size: 12px; font-weight: bold; margin: 0 0 8px 0; text-align: center;">PAYMENT SUMMARY</p>
              ${previouslyCollected > 0 ? `
                <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 11px; line-height: 1.7;">
                  <span>Previously Collected:</span>
                  <span style="font-weight: bold; text-align: right;">${formatCurrency(previouslyCollected)}</span>
                </div>
              ` : ''}
              ${transactionAmount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 11px; line-height: 1.7;">
                  <span>Collected This Transaction:</span>
                  <span style="font-weight: bold; text-align: right;">${formatCurrency(transactionAmount)}</span>
                </div>
              ` : ''}
              ${totalCollected > 0 ? `
                <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 11px; line-height: 1.7;">
                  <span>Total Collected:</span>
                  <span style="font-weight: bold; text-align: right;">${formatCurrency(totalCollected)}</span>
                </div>
              ` : ''}
              ${remainingBalance > 0 ? `
                <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 11px; line-height: 1.7; border-top: 1px dashed #000; padding-top: 6px; color: #c00;">
                  <span style="font-weight: bold;">Remaining Balance:</span>
                  <span style="font-weight: bold; font-size: 12px; text-align: right;">${formatCurrency(remainingBalance)}</span>
                </div>
              ` : ''}
              ${paymentStatusText === 'Payment Not Collected' ? `
                <div style="text-align: center; padding: 8px; margin: 8px 0 0 0; font-size: 12px; font-weight: bold; color: #c00; background-color: #ffe0e0; border: 1px solid #c00; border-radius: 3px;">
                  PAYMENT NOT COLLECTED
                </div>
              ` : ''}
            </div>
      
            <div style="text-align: center; font-size: 10px; color: #333; padding-top: 12px; margin-top: 12px; border-top: 2px dashed #000; line-height: 1.7;">
              <p style="margin: 4px 0; font-weight: bold;">Thank you for your business!</p>
              <p style="margin: 4px 0; font-weight: bold;">Weehena Farm - Quality Poultry Products</p>
              <p style="margin: 4px 0; font-weight: bold;">Contact: [Your Phone Number]</p>
              <p style="margin: 8px 0 0 0; font-size: 9px;">
                Printed: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </body>
      </html>
  `;
};