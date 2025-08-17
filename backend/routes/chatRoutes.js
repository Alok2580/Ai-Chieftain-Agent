const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Booking = require("../models/booking");
const Room = require("../models/Room");
const RoomService = require("../models/RoomService");
const Task = require("../models/Task");
const GuestProfile = require("../models/GuestProfile");
const QRCode = require("qrcode");
const MenuItem = require("../models/MenuItem");
const Document = require("../models/Document");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Basic price map for popular menu items (extendable via admin docs later)
const menuPrices = {
  // Soft drinks
  coke: 3,
  "coke zero": 3,
  sprite: 3,
  fanta: 3,
  "ginger ale": 3,
  "bitter lemon": 3,
  "soda water": 3,
  "tonic water": 3,
  "sparkling water": 3,
  // Teas (fallback generic pricing)
  hibiscus: 6,
  chamomile: 6,
  "english breakfast": 6,
  "green tea": 6,
  "earl grey": 6,
  darjeeling: 6,
  "masala tea": 6,
  "jasmine tea": 6,
  "iced tea": 6,
  // Mocktails
  "virgin mojito": 11,
  "passion mojito": 15,
  "cherry crush": 11,
  "savannah cooler": 11,
  "summer sunset": 11,
  // Beers
  heineken: 6,
  guinness: 6,
  "whitecap lager": 6,
  "tusker lager": 6,
  "corona extra": 6,
  "savannah cider": 6,
  "tusker cider": 6,
  // Bites
  "truffle parmesan fries": 11,
  fries: 6,
};

function normalizeName(n) {
  return n.replace(/\s+/g, " ").trim().toLowerCase();
}

function computeFromMap(message, priceMap) {
  const normalized = message.toLowerCase();
  const entries = Object.entries(priceMap);
  const items = [];
  let subtotal = 0;
  for (const [name, price] of entries) {
    const regex = new RegExp(
      `(?:\\b|^)(?:([0-9]+)x\\s*)?${name.replace(
        /[-/\\^$*+?.()|[\]{}]/g,
        "\\$&"
      )}(?:\\b|$)`,
      "i"
    );
    const match = normalized.match(regex);
    if (match) {
      const qty = match[1] ? parseInt(match[1], 10) : 1;
      const total = qty * price;
      subtotal += total;
      items.push({ name, quantity: qty, price, total });
    }
  }
  return { items, subtotal };
}

async function lookupPriceFromDocuments(itemName) {
  try {
    const docs = await Document.find({ category: "MENU" });
    const pattern = new RegExp(
      itemName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") +
        "[^\n\r$]{0,50}$([0-9]+(?:\\.[0-9]{1,2})?)",
      "i"
    );
    for (const d of docs) {
      if (!d.contentText) continue;
      const m = d.contentText.match(pattern);
      if (m) return parseFloat(m[1]);
    }
  } catch (_) {}
  return undefined;
}

async function computeOrderFromMessage(message) {
  const dbItems = await MenuItem.find({ available: true }).lean();
  const map = { ...menuPrices };
  for (const it of dbItems) {
    map[normalizeName(it.name)] = it.price;
  }

  // first pass direct matches
  let { items, subtotal } = computeFromMap(message, map);

  // heuristic guesses if nothing matched
  if (items.length === 0) {
    const lower = message.toLowerCase();
    const guesses = [];
    if (/hibiscus/.test(lower)) guesses.push({ name: "hibiscus", price: 6 });
    if (/chamomile/.test(lower)) guesses.push({ name: "chamomile", price: 6 });
    if (/english\s*breakfast/.test(lower))
      guesses.push({ name: "english breakfast", price: 6 });
    if (/earl\s*grey/.test(lower))
      guesses.push({ name: "earl grey", price: 6 });
    if (/darjeeling/.test(lower))
      guesses.push({ name: "darjeeling", price: 6 });
    if (/masala\s*tea/.test(lower))
      guesses.push({ name: "masala tea", price: 6 });
    if (/jasmine\s*tea|green\s*tea|tea/.test(lower))
      guesses.push({ name: "tea", price: 6 });
    if (/coffee|espresso|latte|mocha|cappuccino/.test(lower))
      guesses.push({ name: "coffee", price: 6 });
    if (/mocktail|mojito/.test(lower))
      guesses.push({ name: "virgin mojito", price: 11 });
    if (/fries/.test(lower)) guesses.push({ name: "fries", price: 6 });
    for (const g of guesses) {
      items.push({ name: g.name, quantity: 1, price: g.price, total: g.price });
      subtotal += g.price;
    }
  }

  // refine from uploaded docs if possible
  for (const it of items) {
    const inDb = dbItems.find(
      (d) => normalizeName(d.name) === normalizeName(it.name)
    );
    const inMap = Object.prototype.hasOwnProperty.call(menuPrices, it.name);
    if (!inDb && !inMap) {
      const p = await lookupPriceFromDocuments(it.name);
      if (p) {
        subtotal += (p - it.price) * it.quantity;
        it.price = p;
        it.total = p * it.quantity;
      }
    }
  }

  return { items, subtotal };
}

// Canonical, structured in-code menu we want the model to prefer
const hotelInfo = `
You are the AI assistant for Ilora Retreats.

Contact:
- Phone: 0714 543 506, Email: info@ilora-retreats.com, Site: ilora-retreats.com, Location: Masai Mara National Reserve

Phone Extensions:
- Housekeeping: 2, Restaurant: 3, Spa: 4, Security: 5, Driver/Guide: 6, Duty Manager: 7, Concierge: 8

Room Service Menu (canonical; prefer these items and prices unless overridden by admin documents):
- Soft Drinks ($3): Coke, Coke Zero, Sprite, Fanta Orange, Ginger Ale, Bitter Lemon, Soda Water, Tonic Water, Sparkling Water
- Savory Bites: Truffle Parmesan Fries ($11), Fries ($6)
- Beers ($6): Heineken, Guinness, Whitecap Lager, Tusker Lager, Corona Extra, Savannah Cider, Tusker Cider
- Mocktails: Virgin Mojito ($11), Passion Mojito ($15), Cherry Crush ($11), Savannah Cooler ($11), Summer Sunset ($11)

Spa Menu (selected):
- Facials: Balancing ($50), Hydrating ($60), Deluxe Anti-Aging ($80), Ultravine Gold ($80)
- Body Therapies: Relaxing Massage ($70), Back Massage ($40), Deep Tissue ($80)
`;

router.post("/", async (req, res) => {
  try {
    const { message, history, socketId } = req.body;
    if (!socketId) {
      return res.status(400).json({
        reply: "Error: Missing user session ID. Please refresh the page.",
      });
    }

    // Intercept common UI flows before LLM to provide rich UI experiences
    const lowerMsg = String(message || "").toLowerCase();

    // Direct booking intercept - bypass LLM for immediate payment flow
    if (
      /(book|reserve|want.*room|need.*room|get.*room|booking)/.test(lowerMsg)
    ) {
      let nights = 1;
      let rooms = 1;
      const mRooms = message.match(/(\d+)\s*room/gi);
      if (mRooms) {
        const num = parseInt(mRooms[mRooms.length - 1]);
        if (!isNaN(num)) rooms = num;
      }
      const mNights = message.match(/(\d+)\s*(night|nights)/i);
      if (mNights) {
        const num = parseInt(mNights[1]);
        if (!isNaN(num)) nights = num;
      }
      // Use first room type as base; if none seeded, assume $120 base
      let base = 120;
      try {
        const r = await Room.findOne().lean();
        if (r && r.baseRate) base = r.baseRate;
      } catch (_) {}
      // Simple dynamic pricing: +20% per extra room after first, +15% for nights>1
      let perNight = base * (nights > 1 ? 1.15 : 1);
      let total = perNight * nights * rooms;
      total = Math.round(total * 100) / 100;
      // If user not authenticated → ask login
      if (!req.user) {
        return res.json({
          reply: `[LOGIN_REQUIRED] Estimated quote for ${rooms} room(s) for ${nights} night(s). Subtotal: $${total.toFixed(
            2
          )}\nPlease login to proceed to payment.`,
        });
      }
      // Authenticated: include subtotal and QR
      let formatted = `Estimated quote for ${rooms} room(s) for ${nights} night(s).\nSubtotal: $${total.toFixed(
        2
      )}`;
      try {
        const payUrl = `${
          process.env.BASE_URL || ""
        }/api/payments/create-intent?amount=${total.toFixed(2)}`;
        const qr = await QRCode.toDataURL(payUrl);
        formatted += `\nScan to pay (demo QR): ${qr}`;
      } catch (_) {}
      return res.json({ reply: formatted });
    }

    if (/(^|\b)(menu|show (me )?the menu)\b/.test(lowerMsg)) {
      // Ensure we have some default menu items if admin hasn't added any
      try {
        const existingItems = await MenuItem.find().countDocuments();
        if (existingItems === 0) {
          // Seed default menu items
          const defaults = [
            { category: "Tea", name: "Hibiscus Tea", price: 6 },
            { category: "Tea", name: "English Breakfast", price: 6 },
            { category: "Tea", name: "Masala Chai", price: 6 },
            { category: "Coffee", name: "Espresso", price: 6 },
            { category: "Coffee", name: "Cappuccino", price: 7 },
            { category: "Coffee", name: "Latte", price: 7 },
            { category: "Food", name: "Truffle Parmesan Fries", price: 11 },
            { category: "Food", name: "Fries", price: 6 },
            { category: "Cold Drinks", name: "Coke", price: 3 },
            { category: "Cold Drinks", name: "Sprite", price: 3 },
            { category: "Mocktails", name: "Virgin Mojito", price: 11 },
            { category: "Mocktails", name: "Passion Mojito", price: 15 },
            { category: "Beers", name: "Heineken", price: 6 },
            { category: "Beers", name: "Corona Extra", price: 6 },
          ];
          for (const item of defaults) {
            await MenuItem.findOneAndUpdate(
              { name: item.name, category: item.category },
              item,
              { upsert: true, new: true }
            );
          }
        }
      } catch (_) {}

      const payload = {
        type: "menu.categories",
        title: "Choose a category",
        categories: [
          "Tea",
          "Coffee",
          "Food",
          "Cold Drinks",
          "Mocktails",
          "Beers",
        ],
      };
      return res.json({ reply: `[[UI]]${JSON.stringify(payload)}` });
    }
    if (/(upgrade|room upgrade)/.test(lowerMsg)) {
      const payload = {
        type: "upgrade.cards",
        title: "Available Upgrades",
        rooms: [
          {
            id: "deluxe",
            name: "Deluxe Room",
            desc: "King bed, balcony view",
            image: "https://picsum.photos/seed/deluxe/400/220",
            diff: 40,
          },
          {
            id: "suite",
            name: "Executive Suite",
            desc: "Jacuzzi, ocean view",
            image: "https://picsum.photos/seed/suite/400/220",
            diff: 120,
          },
          {
            id: "villa",
            name: "Private Villa",
            desc: "Two rooms, private deck",
            image: "https://picsum.photos/seed/villa/400/220",
            diff: 220,
          },
        ],
      };
      return res.json({ reply: `[[UI]]${JSON.stringify(payload)}` });
    }

    if (/(what can i do|activities|things to do|tomorrow)/.test(lowerMsg)) {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      const payload = {
        type: "activities.carousel",
        title: "Suggested Activities",
        activities: [
          {
            id: "safari",
            title: "Sunrise Safari",
            date: tomorrow,
            price: 60,
            image: "https://picsum.photos/seed/safari/400/220",
          },
          {
            id: "spa-yoga",
            title: "Morning Yoga",
            date: tomorrow,
            price: 20,
            image: "https://picsum.photos/seed/yoga/400/220",
          },
          {
            id: "culinary",
            title: "Culinary Class",
            date: tomorrow,
            price: 35,
            image: "https://picsum.photos/seed/culinary/400/220",
          },
        ],
      };
      return res.json({ reply: `[[UI]]${JSON.stringify(payload)}` });
    }

    if (/(breakfast|i want breakfast)/.test(lowerMsg)) {
      const payload = {
        type: "wizard.breakfast",
        step: "diet",
        options: ["Vegetarian", "Vegan", "Non-Veg"],
      };
      return res.json({ reply: `[[UI]]${JSON.stringify(payload)}` });
    }

    if (/(spa|wellness)/.test(lowerMsg)) {
      const payload = {
        type: "cards.spa",
        title: "Recommended Spa Treatments",
        items: [
          {
            id: "relax",
            name: "Relaxing Massage",
            duration: "60 min",
            price: 70,
            image: "https://picsum.photos/seed/spa1/400/220",
          },
          {
            id: "deep",
            name: "Deep Tissue",
            duration: "60 min",
            price: 80,
            image: "https://picsum.photos/seed/spa2/400/220",
          },
          {
            id: "facial",
            name: "Hydrating Facial",
            duration: "45 min",
            price: 60,
            image: "https://picsum.photos/seed/spa3/400/220",
          },
        ],
      };
      return res.json({ reply: `[[UI]]${JSON.stringify(payload)}` });
    }

    if (/(housekeeping|clean (my )?room)/.test(lowerMsg)) {
      const now = new Date();
      const slots = [];
      for (let i = 1; i <= 6; i++) {
        const t = new Date(now.getTime() + i * 60 * 60 * 1000);
        slots.push(t.toTimeString().slice(0, 5));
      }
      const payload = {
        type: "timeslots",
        title: "Choose a housekeeping slot",
        slots,
      };
      return res.json({ reply: `[[UI]]${JSON.stringify(payload)}` });
    }

    if (/(lost|i lost|lost & found)/.test(lowerMsg)) {
      const ticketId =
        "LF-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      const payload = {
        type: "lostfound.new",
        title: "Lost & Found",
        ticketId,
        status: "Searching room",
      };
      return res.json({ reply: `[[UI]]${JSON.stringify(payload)}` });
    }

    // Direct room service intercept - bypass LLM for immediate billing
    if (
      /(order|want.*food|bring.*food|room service|hungry|thirsty|food|drink)/.test(
        lowerMsg
      )
    ) {
      const { items, subtotal } = await computeOrderFromMessage(message);
      const newOrder = new RoomService({
        details: message,
        socketId: socketId,
      });
      await newOrder.save();
      io.emit("new_room_service", newOrder);
      let formatted = items.length
        ? `\n\nYour order summary:\n${items
            .map(
              (i) =>
                `- ${i.quantity} x ${i.name} @ $${i.price} = $${i.total.toFixed(
                  2
                )}`
            )
            .join("\n")}\nSubtotal: $${subtotal.toFixed(2)}`
        : "";
      // If user not authenticated, require login before payment
      if (!req.user) {
        return res.json({
          reply: `[LOGIN_REQUIRED] Please login to complete your order.${formatted}`,
        });
      }
      if (subtotal > 0) {
        try {
          const payUrl = `${
            process.env.BASE_URL || ""
          }/api/payments/create-intent?amount=${subtotal.toFixed(2)}`;
          const qr = await QRCode.toDataURL(payUrl);
          formatted += `\nScan to pay (demo QR): ${qr}`;
        } catch (_) {
          /* ignore */
        }
      }
      return res.json({ reply: `Your order has been placed!${formatted}` });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const io = req.app.get("socketio");

    const formattedHistory = history
      .map(
        (msg) =>
          `${msg.sender === "bot" ? "AI Assistant" : "User"}: ${msg.text}`
      )
      .join("\n");

    // Load latest admin documents (titles + links) to enrich knowledge
    let docsSnippet = "";
    try {
      const Document = require("../models/Document");
      const docs = await Document.find().sort({ uploadedAt: -1 }).limit(10);
      if (docs.length) {
        const shortList = docs
          .map(
            (d) =>
              `- ${d.title} [${d.category}] -> ${process.env.BASE_URL || ""}${
                d.filePath
              }`
          )
          .join("\n");
        const textual = docs
          .filter((d) => !!d.contentText)
          .map(
            (d) =>
              `\n# ${d.title} (${d.category})\n${d.contentText.substring(
                0,
                2000
              )}`
          ) // cap for prompt
          .join("\n\n");
        docsSnippet = `\n\nAdditional Hotel Documents (latest):\n${shortList}\n\nExtracts from uploaded documents for grounding:\n${textual}`;
      }
    } catch (_) {
      /* ignore */
    }

    const masterPrompt = `
      You are the AI Hotel Concierge for Ilora Retreats.
      Your knowledge base is provided below in the "Hotel Information" section.
      Your task is to analyze the user's message in the context of the conversation history and take ONE of the following actions:

      1.  **BOOKING:** If the user wants to book, reserve, or make an appointment for a room or a spa treatment.
          - Your response MUST start with the special tag "[ACTION:BOOKING]".
          - After the tag, provide a friendly confirmation message to the user. For example: "[ACTION:BOOKING] I've noted your booking request for a relaxing massage. Our staff will confirm the details with you shortly."

      2.  **ROOM_SERVICE:** If the user is clearly ordering one or more specific items of food or drink (e.g., "I want a coke," "bring me Truffle Parmesan Fries").
          - Your response MUST start with the special tag "[ACTION:ROOM_SERVICE]".
          - After the tag, provide a friendly confirmation message. For example: "[ACTION:ROOM_SERVICE] Your order for a Coke and Truffle Parmesan Fries has been placed. Our staff is reviewing it and you will receive a confirmation shortly."

      3.  **GENERAL_QUERY:** For all other questions, including requests to see the menu(if user asks to  menu then go to hotel info and extract menu information from that), questions about prices, spa services, or phone extensions.
          - Answer the user's question directly using the provided "Hotel Information".
          // - If you are showing the menu , tell hotel information."
          - Your response for this category should NOT contain any special tags.

      4. **PROFILE_UPDATE:** If the user shares preferences like room temperature, pillow type, dietary/allergy, accessibility, language, name, or contact info, start the response with "[ACTION:PROFILE_UPDATE]" followed by a friendly confirmation of what was captured.

      5. **TASK:** If the user asks for a concierge task beyond booking/room-service (e.g., airport pickup, maintenance request, wake-up call), start the response with "[ACTION:TASK]" and confirm the request.

      IMPORTANT: Prefer facts from the section "Additional Hotel Documents" if present, especially for menu items, phone extensions, or guides (like door lock instructions). When you use a document, include a short citation like "Source: <Document Title>" and provide the file link if available. If a detail is missing from both documents and Hotel Information, politely say it is not available and suggest that the admin can upload it.

      **Hotel Information:**
      ${hotelInfo}
      ${docsSnippet}

      **Conversation History:**
      ${formattedHistory}

      **User's Latest Message:** "${message}"

      Now, generate the appropriate response based on the User's Latest Message.
    `;

    const result = await model.generateContent(masterPrompt);
    let replyText = (await result.response).text().trim();

    if (replyText.startsWith("[ACTION:BOOKING]")) {
      // Quick quote and payment prompt instead of plain acknowledgement
      // Parse simple nights/rooms from message; default 1 night, 1 room
      let nights = 1;
      let rooms = 1;
      const mRooms = message.match(/(\d+)\s*room/gi);
      if (mRooms) {
        const num = parseInt(mRooms[mRooms.length - 1]);
        if (!isNaN(num)) rooms = num;
      }
      const mNights = message.match(/(\d+)\s*(night|nights)/i);
      if (mNights) {
        const num = parseInt(mNights[1]);
        if (!isNaN(num)) nights = num;
      }
      // Use first room type as base; if none seeded, assume $120 base
      let base = 120;
      try {
        const r = await Room.findOne().lean();
        if (r && r.baseRate) base = r.baseRate;
      } catch (_) {}
      // Simple dynamic pricing: +20% per extra room after first, +15% for nights>1
      let perNight = base * (nights > 1 ? 1.15 : 1);
      let total = perNight * nights * rooms;
      total = Math.round(total * 100) / 100;
      // If user not authenticated → ask login
      if (!req.user) {
        return res.json({
          reply: `[LOGIN_REQUIRED] Estimated quote for ${rooms} room(s) for ${nights} night(s). Subtotal: $${total.toFixed(
            2
          )}\nPlease login to proceed to payment.`,
        });
      }
      // Authenticated: include subtotal and QR
      let formatted = `Estimated quote for ${rooms} room(s) for ${nights} night(s).\nSubtotal: $${total.toFixed(
        2
      )}`;
      try {
        const payUrl = `${
          process.env.BASE_URL || ""
        }/api/payments/create-intent?amount=${total.toFixed(2)}`;
        const qr = await QRCode.toDataURL(payUrl);
        formatted += `\nScan to pay (demo QR): ${qr}`;
      } catch (_) {}
      return res.json({ reply: formatted });
    } else if (replyText.startsWith("[ACTION:ROOM_SERVICE]")) {
      const { items, subtotal } = await computeOrderFromMessage(message);
      const newOrder = new RoomService({
        details: message,
        socketId: socketId,
      });
      await newOrder.save();
      io.emit("new_room_service", newOrder);
      let formatted = items.length
        ? `\n\nYour order summary:\n${items
            .map(
              (i) =>
                `- ${i.quantity} x ${i.name} @ $${i.price} = $${i.total.toFixed(
                  2
                )}`
            )
            .join("\n")}\nSubtotal: $${subtotal.toFixed(2)}`
        : "";
      // If user not authenticated, require login before payment
      if (!req.user) {
        return res.json({
          reply: `[LOGIN_REQUIRED] Please login to complete your order.${formatted}`,
        });
      }
      if (subtotal > 0) {
        try {
          const payUrl = `${
            process.env.BASE_URL || ""
          }/api/payments/create-intent?amount=${subtotal.toFixed(2)}`;
          const qr = await QRCode.toDataURL(payUrl);
          formatted += `\nScan to pay (demo QR): ${qr}`;
        } catch (_) {
          /* ignore */
        }
      }
      replyText =
        replyText.replace("[ACTION:ROOM_SERVICE]", "").trim() + formatted;
    } else if (replyText.startsWith("[ACTION:PROFILE_UPDATE]")) {
      const profile = new GuestProfile({
        socketId,
        preferences: { notes: message },
      });
      await profile.save();
      io.emit("profile_updated", profile);
      replyText = replyText.replace("[ACTION:PROFILE_UPDATE]", "").trim();
    } else if (replyText.startsWith("[ACTION:TASK]")) {
      const task = new Task({ type: "CONCIERGE", details: message, socketId });
      await task.save();
      io.emit("new_task", task);
      replyText = replyText.replace("[ACTION:TASK]", "").trim();
    }
    // If it's a GENERAL_QUERY, replyText is sent as is.

    res.json({ reply: replyText });
  } catch (error) {
    console.error("Error in chat route:", error);
    res.status(500).json({
      reply:
        "An error occurred while processing your request. Please try again.",
    });
  }
});

// ... other routes for PUT and GET are unchanged ...
router.put("/bookings/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ msg: "Booking not found" });

    booking.status = status;
    await booking.save();

    const io = req.app.get("socketio");
    io.emit("booking_status_updated", booking);

    const userMessage =
      status === "Approved"
        ? "Great news! Your booking request has been approved by our staff."
        : "We are sorry, but your booking request has been declined. Please contact the front desk for more information.";

    io.to(booking.socketId).emit("booking_response", { text: userMessage });
    res.json(booking);
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).send("Server Error");
  }
});

router.put("/room-service/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const order = await RoomService.findById(req.params.id);
    if (!order) return res.status(404).json({ msg: "Order not found" });

    order.status = status;
    await order.save();

    const io = req.app.get("socketio");
    io.emit("room_service_status_updated", order);

    const userMessage =
      status === "Approved"
        ? "Your room service order has been approved and is being prepared! It will be delivered in approximately 30 minutes."
        : "We apologize, but there was an issue with your room service order and it has been declined. Please contact the front desk.";

    io.to(order.socketId).emit("room_service_response", { text: userMessage });
    res.json(order);
  } catch (error) {
    console.error("Error updating room service order:", error);
    res.status(500).send("Server Error");
  }
});

router.get("/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.get("/room-service", async (req, res) => {
  try {
    const orders = await RoomService.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;
