const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

const stripeSecret = process.env.STRIPE_SECRET || "sk_test_12345";
const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });
const QRCode = require("qrcode");

// Demo-only: create a payment intent for a specified amount (in USD)
router.post("/create-intent", async (req, res) => {
  try {
    const { amount } = req.body; // amount in dollars
    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    res.status(500).json({ message: err.message || "Stripe error" });
  }
});

module.exports = router;

// Extra endpoint: return a QR data URL for a given amount (demo)
router.get("/qr", async (req, res) => {
  try {
    const { amount } = req.query;
    const payUrl = `${
      process.env.BASE_URL || ""
    }/api/payments/create-intent?amount=${Number(amount || 0).toFixed(2)}`;
    const qr = await QRCode.toDataURL(payUrl);
    res.json({ qr });
  } catch (e) {
    res.status(500).json({ message: "QR generation failed" });
  }
});
