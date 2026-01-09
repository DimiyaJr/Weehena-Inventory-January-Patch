import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.4";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-internal-send-token",
};

// --- ENVIRONMENT VARIABLES ---
const AWS_REGION = Deno.env.get("AWS_REGION");
const SES_SMTP_USERNAME = Deno.env.get("SES_SMTP_USERNAME");
const SES_SMTP_PASSWORD = Deno.env.get("SES_SMTP_PASSWORD");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL");
const INTERNAL_SEND_TOKEN = Deno.env.get("INTERNAL_SEND_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// --- MAIN FUNCTION ---
Deno.serve(async (req) => {
  try {
    console.log("=== Edge Function Started ===");

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    // --- AUTHENTICATION ---
    const internalTokenHeader = req.headers.get("x-internal-send-token");
    console.log("Received internal token:", internalTokenHeader ? "Present" : "Missing");
    
    if (!INTERNAL_SEND_TOKEN || internalTokenHeader !== INTERNAL_SEND_TOKEN) {
      console.error("Unauthorized: Invalid or missing internal token");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized: Invalid internal token",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- VALIDATE ENVIRONMENT VARIABLES ---
    const missingEnvVars = [];
    if (!AWS_REGION) missingEnvVars.push("AWS_REGION");
    if (!SES_SMTP_USERNAME) missingEnvVars.push("SES_SMTP_USERNAME");
    if (!SES_SMTP_PASSWORD) missingEnvVars.push("SES_SMTP_PASSWORD");
    if (!FROM_EMAIL) missingEnvVars.push("FROM_EMAIL");
    if (!SUPABASE_URL) missingEnvVars.push("SUPABASE_URL");
    if (!SUPABASE_SERVICE_ROLE_KEY) missingEnvVars.push("SUPABASE_SERVICE_ROLE_KEY");

    if (missingEnvVars.length > 0) {
      console.error("Missing environment variables:", missingEnvVars);
      throw new Error(`Missing environment variables: ${missingEnvVars.join(", ")}`);
    }

    console.log("AWS Region:", AWS_REGION);
    console.log("SES SMTP Username present:", SES_SMTP_USERNAME ? "Yes" : "No");
    console.log("SES SMTP Password present:", SES_SMTP_PASSWORD ? "Yes" : "No");
    console.log("From Email:", FROM_EMAIL);

    // --- PARSE REQUEST BODY ---
    let requestData;
    try {
      requestData = await req.json();
      console.log("Received order data for email");
    } catch (parseError) {
      console.error("Invalid JSON body:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- DESTRUCTURE REQUEST FIELDS ---
    const {
      to: customerEmail,
      customerName,
      orderDisplayId,
      receiptNo,
      totalAmount,
      paymentMethod,
      orderItems,
      orderDate,
      salesRepName,
      vehicleNumber,
      orderId,
    } = requestData;

    // --- VALIDATE REQUIRED FIELDS ---
    if (!customerEmail || !customerName || !orderDisplayId) {
      throw new Error("Missing required fields: customerEmail, customerName, or orderDisplayId");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      throw new Error("Invalid email format");
    }

    // --- INITIALIZE SUPABASE CLIENT ---
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- CREATE AWS SES TRANSPORTER ---
    console.log("Creating AWS SES transporter...");
    
    // AWS SES SMTP Configuration
    const transporter = nodemailer.createTransport({
      host: `email-smtp.${AWS_REGION}.amazonaws.com`,
      port: 587,
      secure: false,
      auth: {
        user: SES_SMTP_USERNAME,
        pass: SES_SMTP_PASSWORD,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // --- VERIFY SMTP CONNECTION ---
    console.log("Verifying SMTP connection...");
    try {
      await transporter.verify();
      console.log("SMTP connection verified successfully");
    } catch (verifyError) {
      console.error("SMTP verification failed:", verifyError);
      
      let errorMessage = "SMTP connection failed";
      if (verifyError.code === "EAUTH") {
        errorMessage = "AWS SES SMTP authentication failed. Please check your SMTP credentials.";
      } else if (verifyError.code === "ECONNECTION") {
        errorMessage = "Could not connect to AWS SES. Check your region and network settings.";
      } else {
        errorMessage = `SMTP error: ${verifyError.message}`;
      }
      
      throw new Error(errorMessage);
    }

    // --- GENERATE EMAIL HTML ---
    const orderItemsHtml = (orderItems || [])
      .map(
        (item) => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.productName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.price}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${item.total}</td>
          </tr>`
      )
      .join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #e44d26; padding-bottom: 20px; margin-bottom: 20px; }
          .company-name { font-size: 24px; font-weight: bold; color: #e44d26; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background-color: #f8f9fa; text-align: left; padding: 12px; border-bottom: 2px solid #dee2e6; }
          td { padding: 12px; border-bottom: 1px solid #dee2e6; }
          .total-row { font-weight: bold; background-color: #f8f9fa; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="company-name">WEEHENA FARM</div>
            <div style="color: #666; margin: 5px 0;">A Taste with Quality</div>
            <div style="font-size: 20px; margin: 10px 0;">SALES RECEIPT</div>
          </div>

          <div style="margin-bottom: 20px;">
            <h3>ORDER DETAILS</h3>
            <p><strong>Order ID:</strong> ${orderDisplayId}<br>
            <strong>Receipt No:</strong> ${receiptNo || 'N/A'}<br>
            <strong>Date:</strong> ${orderDate || new Date().toLocaleDateString()}<br>
            <strong>Payment Method:</strong> ${paymentMethod || 'N/A'}</p>
          </div>

          <div style="margin-bottom: 20px;">
            <h3>BILL TO</h3>
            <p><strong>${customerName}</strong><br>
            <strong>Sales Rep:</strong> ${salesRepName || 'N/A'}<br>
            ${vehicleNumber ? `<strong>Vehicle:</strong> ${vehicleNumber}` : ''}</p>
          </div>

          <h3>ORDER ITEMS</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align: right;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsHtml}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">GRAND TOTAL:</td>
                <td style="text-align: right;">${totalAmount}</td>
              </tr>
            </tfoot>
          </table>

          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Weehena Farm - Quality Poultry Products</p>
          </div>
        </div>
      </body>
      </html>`;

    // --- SEND EMAIL ---
    console.log("Sending email to:", customerEmail);
    
    const mailOptions = {
      from: `Weehena Farm <${FROM_EMAIL}>`,
      to: customerEmail,
      subject: `Receipt ${receiptNo} - Order ${orderDisplayId}`,
      html: emailHtml,
      text: `Receipt ${receiptNo} for Order ${orderDisplayId}\nTotal Amount: ${totalAmount}\n\nThank you for your business!`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Receipt email sent successfully.",
        messageId: info.messageId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (err) {
    console.error("Fatal error in send-receipt-email:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorDetails = err instanceof Error && err.stack ? err.stack : "No stack trace available";

    console.error("Error details:", errorDetails);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});