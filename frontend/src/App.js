import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import "./App.css";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:5001" : "");
const socket = io(API_BASE || undefined);

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  recognition.continuous = false;
  recognition.lang = "en-US";
  recognition.interimResults = false;
}

function App() {
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Welcome to the Hotel Concierge! How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [socketId, setSocketId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const messageListRef = useRef(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    language: "en",
    preferences: {
      roomTemperatureCelsius: "",
      pillowType: "",
      dietaryPreferences: "",
      allergies: "",
      accessibilityNeeds: "",
      notes: "",
    },
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [checkout, setCheckout] = useState({ open: false, amount: 0 });
  const [stripe, setStripe] = useState(null);
  const [stripeClientSecret, setStripeClientSecret] = useState("");
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [pendingAmount, setPendingAmount] = useState(null);
  const [uiPanel, setUiPanel] = useState(null);
  const [menuMaster, setMenuMaster] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    socket.on("connect", () => {
      setSocketId(socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("booking_response", (data) => {
      const staffMessage = { sender: "bot", text: data.text };
      setMessages((prev) => [...prev, staffMessage]);
    });

    socket.on("room_service_response", (data) => {
      const staffMessage = { sender: "bot", text: data.text };
      setMessages((prev) => [...prev, staffMessage]);
    });

    socket.on("task_response", (data) => {
      const staffMessage = { sender: "bot", text: data.text };
      setMessages((prev) => [...prev, staffMessage]);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("booking_response");
      socket.off("room_service_response");
      socket.off("task_response");
    };
  }, []);

  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
  }, []);

  useEffect(() => {
    // Preload admin menu for interactive UI with fallback
    axios
      .get(`${API_BASE}/api/menu`)
      .then((r) => setMenuMaster(r.data || []))
      .catch(() => {
        // Fallback menu items if API fails
        const fallbackMenu = [
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
        setMenuMaster(fallbackMenu);
      });
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !isConnected) return;

    const userMessage = { sender: "user", text: input };

    // --- CORRECTED LOGIC: Send the history *before* the new message ---
    const historyForApi = messages.slice(-10);

    setMessages((prev) => [...prev, userMessage]); // Update UI immediately
    const messageToSend = input;
    setInput("");

    try {
      const response = await axios.post(
        `${API_BASE}/api/chat`,
        {
          message: messageToSend,
          history: historyForApi, // Send the history *without* the new message
          socketId: socketId,
        },
        { withCredentials: true }
      );
      // Handle special UI payloads first - don't add raw JSON to chat
      if (
        typeof response.data.reply === "string" &&
        response.data.reply.startsWith("[[UI]]")
      ) {
        try {
          const payload = JSON.parse(response.data.reply.replace("[[UI]]", ""));
          setUiPanel(payload);
          // Add a user-friendly message instead of raw JSON
          const friendlyMessage = {
            sender: "bot",
            text: `Here's the ${payload.title.toLowerCase()}:`,
          };
          setMessages((prevMessages) => [...prevMessages, friendlyMessage]);
          return; // Don't process further
        } catch (_) {
          /* ignore and continue to normal processing */
        }
      }

      // Handle login required
      if (
        typeof response.data.reply === "string" &&
        response.data.reply.startsWith("[LOGIN_REQUIRED]")
      ) {
        setLoginPrompt(true);
        const m2 = /Subtotal:\s*\$(\d+(?:\.\d{1,2})?)/i.exec(
          response.data.reply
        );
        if (m2) {
          setPendingAmount(parseFloat(m2[1]));
        }
        // Add a user-friendly message instead of raw login required text
        const friendlyMessage = {
          sender: "bot",
          text: "Please log in to continue with your request.",
        };
        setMessages((prevMessages) => [...prevMessages, friendlyMessage]);
        return; // Don't process further
      }

      // Normal bot message
      const botMessage = { sender: "bot", text: response.data.reply };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
      // detect subtotal in reply e.g., Subtotal: $12.34
      const m = /Subtotal:\s*\$(\d+(?:\.\d{1,2})?)/i.exec(
        response.data.reply || ""
      );
      if (m) {
        const amt = parseFloat(m[1]);
        try {
          const me = await axios
            .get(`${API_BASE}/api/auth/me`, { withCredentials: true })
            .then((r) => r.data);
          if (!me) {
            setPendingAmount(amt);
            setLoginPrompt(true);
            return;
          }
        } catch (_) {
          /* ignore and continue to open */
        }
        setCheckout({ open: true, amount: amt });
        try {
          const intent = await axios.post(
            `${API_BASE}/api/payments/create-intent`,
            { amount: amt }
          );
          setStripeClientSecret(intent.data.clientSecret);
        } catch (_) {
          /* demo proceeds without real secret */
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        sender: "bot",
        text: "Sorry, I am having trouble connecting to the server.",
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    }
  };

  const handleVoiceListen = () => {
    if (!isConnected) return;
    if (!recognition) {
      alert("Sorry, your browser does not support voice recognition.");
      return;
    }
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...profileForm, socketId };
      try {
        await axios.post(`${API_BASE}/api/profiles`, payload);
      } catch (primaryErr) {
        // Fallback to localhost if remote is outdated/missing routes
        if (!API_BASE.includes("localhost")) {
          await axios.post(`http://localhost:5001/api/profiles`, payload);
        } else {
          throw primaryErr;
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Thanks! Your preferences have been saved. We'll personalize your stay.",
        },
      ]);
      setProfileSaved(true);
      setProfileForm({
        name: "",
        email: "",
        phone: "",
        language: "en",
        preferences: {
          roomTemperatureCelsius: "",
          pillowType: "",
          dietaryPreferences: "",
          allergies: "",
          accessibilityNeeds: "",
          notes: "",
        },
      });
    } catch (err) {
      console.error("Profile save failed", err?.response?.data || err?.message);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `Couldn't save preferences: ${
            err?.response?.data?.message || "Server error"
          }`,
        },
      ]);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>AI Hotel Concierge</h2>
        <div className={`connection-status ${isConnected ? "connected" : ""}`}>
          {isConnected ? "Connected" : "Connecting..."}
        </div>
      </div>
      <div className="message-list" ref={messageListRef}>
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.sender}`}>
            <p>{message.text}</p>
          </div>
        ))}
      </div>
      {checkout.open && (
        <div
          style={{
            padding: 12,
            borderTop: "1px solid #eee",
            background: "#fafafa",
          }}
        >
          <strong>Payment</strong>
          <div style={{ marginTop: 8 }}>
            Amount: ${checkout.amount.toFixed(2)}
          </div>
          {!stripeClientSecret ? (
            <button
              style={{ marginTop: 8 }}
              onClick={() => {
                setCheckout({ open: false, amount: 0 });
                setMessages((p) => [
                  ...p,
                  { sender: "bot", text: "Payment successful (demo)." },
                ]);
              }}
            >
              Confirm (Demo)
            </button>
          ) : (
            <button
              style={{ marginTop: 8 }}
              onClick={() => {
                setCheckout({ open: false, amount: 0 });
                setMessages((p) => [
                  ...p,
                  {
                    sender: "bot",
                    text: "Payment successful via Stripe test!",
                  },
                ]);
              }}
            >
              Pay with Stripe Test
            </button>
          )}
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
            Use Stripe test details (4242 4242 4242 4242, 12/34, 123) in a real
            Elements form; here we simulate with a button for speed.
          </div>
        </div>
      )}
      {loginPrompt && (
        <div
          style={{
            padding: 12,
            borderTop: "1px solid #eee",
            background: "#fafafa",
          }}
        >
          <strong>Login to continue</strong>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <button
              onClick={async () => {
                try {
                  await axios.post(
                    `${API_BASE}/api/auth/login`,
                    { email: loginEmail, password: loginPassword },
                    { withCredentials: true }
                  );
                  setLoginPrompt(false);
                  setMessages((p) => [
                    ...p,
                    {
                      sender: "bot",
                      text: "Logged in successfully. You can complete your order now.",
                    },
                  ]);
                  if (pendingAmount) {
                    setCheckout({ open: true, amount: pendingAmount });
                    setPendingAmount(null);
                  }
                } catch (err) {
                  setMessages((p) => [
                    ...p,
                    { sender: "bot", text: "Login failed. Please try again." },
                  ]);
                }
              }}
            >
              Login
            </button>
          </div>
        </div>
      )}
      {uiPanel && uiPanel.type === "menu.categories" && (
        <div
          style={{
            padding: 12,
            borderTop: "1px solid #eee",
            background: "#fff",
          }}
        >
          <strong>{uiPanel.title}</strong>
          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}
          >
            {uiPanel.categories.map((cat) => (
              <button
                key={cat}
                onClick={async () => {
                  // Fetch fresh menu items for this category
                  try {
                    console.log("Fetching menu items for category:", cat);
                    const response = await axios.get(`${API_BASE}/api/menu`);
                    console.log("Menu API response:", response.data);
                    const allItems = response.data || [];
                    const items = allItems.filter(
                      (m) =>
                        (m.category || "").toLowerCase() === cat.toLowerCase()
                    );
                    console.log("Filtered items for", cat, ":", items);
                    setSelectedItems({});
                    setUiPanel({
                      type: "menu.items",
                      title: `${cat} Menu`,
                      category: cat,
                      items,
                    });
                  } catch (error) {
                    console.error("Failed to load menu items:", error);
                    // Use fallback menu items if API fails
                    const fallbackMenu = [
                      { category: "Tea", name: "Hibiscus Tea", price: 6 },
                      { category: "Tea", name: "English Breakfast", price: 6 },
                      { category: "Tea", name: "Masala Chai", price: 6 },
                      { category: "Coffee", name: "Espresso", price: 6 },
                      { category: "Coffee", name: "Cappuccino", price: 7 },
                      { category: "Coffee", name: "Latte", price: 7 },
                      {
                        category: "Food",
                        name: "Truffle Parmesan Fries",
                        price: 11,
                      },
                      { category: "Food", name: "Fries", price: 6 },
                      { category: "Cold Drinks", name: "Coke", price: 3 },
                      { category: "Cold Drinks", name: "Sprite", price: 3 },
                      {
                        category: "Mocktails",
                        name: "Virgin Mojito",
                        price: 11,
                      },
                      {
                        category: "Mocktails",
                        name: "Passion Mojito",
                        price: 15,
                      },
                      { category: "Beers", name: "Heineken", price: 6 },
                      { category: "Beers", name: "Corona Extra", price: 6 },
                    ];
                    const items = fallbackMenu.filter(
                      (m) =>
                        (m.category || "").toLowerCase() === cat.toLowerCase()
                    );
                    setSelectedItems({});
                    setUiPanel({
                      type: "menu.items",
                      title: `${cat} Menu`,
                      category: cat,
                      items,
                    });
                  }
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}
      {uiPanel && uiPanel.type === "menu.items" && (
        <div
          style={{
            padding: 12,
            borderTop: "1px solid #eee",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>{uiPanel.title}</strong>
            <button
              onClick={() =>
                setUiPanel({
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
                })
              }
              style={{ padding: "4px 8px", fontSize: "12px" }}
            >
              Back to Categories
            </button>
          </div>
          <div style={{ marginTop: 8 }}>
            {uiPanel.items && uiPanel.items.length > 0 ? (
              uiPanel.items.map((it) => (
                <div
                  key={it._id || it.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedItems[it.name]}
                    onChange={(e) => {
                      setSelectedItems((s) => ({
                        ...s,
                        [it.name]: e.target.checked ? 1 : undefined,
                      }));
                    }}
                  />
                  <span style={{ flex: 1 }}>
                    {it.name} - ${it.price.toFixed(2)}
                  </span>
                  {selectedItems[it.name] && (
                    <input
                      type="number"
                      min="1"
                      value={selectedItems[it.name]}
                      onChange={(e) => {
                        const val = Math.max(
                          1,
                          parseInt(e.target.value || "1", 10)
                        );
                        setSelectedItems((s) => ({ ...s, [it.name]: val }));
                      }}
                      style={{ width: 60 }}
                    />
                  )}
                </div>
              ))
            ) : (
              <div style={{ color: "#666", fontStyle: "italic" }}>
                No items found in {uiPanel.category} category.
                <br />
                <button
                  onClick={() => setUiPanel(null)}
                  style={{ marginTop: 4, padding: "4px 8px", fontSize: "12px" }}
                >
                  Back to Categories
                </button>
              </div>
            )}
          </div>
          <button
            style={{ marginTop: 8 }}
            onClick={async () => {
              const entries = Object.entries(selectedItems).filter(
                ([k, v]) => v && v > 0
              );
              if (!entries.length) {
                setMessages((p) => [
                  ...p,
                  { sender: "bot", text: "Please select at least one item." },
                ]);
                return;
              }
              const orderText = entries
                .map(([name, qty]) => `${qty} ${name}`)
                .join(", ");
              // send as chat to leverage backend billing and payment
              const syntheticEvent = { preventDefault: () => {} };
              setInput(`order ${orderText}`);
              await handleSend(syntheticEvent);
              setUiPanel(null);
            }}
          >
            Order Selected
          </button>
        </div>
      )}
      {uiPanel && uiPanel.type === "upgrade.cards" && (
        <div
          style={{
            padding: 12,
            borderTop: "1px solid #eee",
            background: "#fff",
          }}
        >
          <strong>{uiPanel.title}</strong>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))",
              gap: 12,
              marginTop: 8,
            }}
          >
            {uiPanel.rooms.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <img
                  alt={r.name}
                  src={r.image}
                  style={{ width: "100%", height: 120, objectFit: "cover" }}
                />
                <div style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ color: "#555", margin: "4px 0" }}>{r.desc}</div>
                  <div>+${r.diff}/night</div>
                  <button
                    style={{ marginTop: 6 }}
                    onClick={() => setUiPanel({ ...uiPanel, selected: r })}
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
          {uiPanel.selected && (
            <div style={{ marginTop: 8 }}>
              <div>
                Selected: {uiPanel.selected.name} (+${uiPanel.selected.diff}
                /night)
              </div>
              <button
                style={{ marginTop: 6 }}
                onClick={async () => {
                  // create a concierge task and open payment panel with diff as demo
                  try {
                    await axios.post(`${API_BASE}/api/tasks`, {
                      type: "CONCIERGE",
                      details: `Upgrade to ${uiPanel.selected.name}`,
                      socketId,
                    });
                  } catch (_) {}
                  const amt = uiPanel.selected.diff;
                  try {
                    const me = await axios
                      .get(`${API_BASE}/api/auth/me`, { withCredentials: true })
                      .then((r) => r.data);
                    if (!me) {
                      setPendingAmount(amt);
                      setLoginPrompt(true);
                      return;
                    }
                  } catch (_) {}
                  setCheckout({ open: true, amount: amt });
                  setUiPanel(null);
                }}
              >
                Confirm upgrade
              </button>
            </div>
          )}
        </div>
      )}
      {uiPanel && uiPanel.type === "activities.carousel" && (
        <div
          style={{
            padding: 12,
            borderTop: "1px solid #eee",
            background: "#fff",
          }}
        >
          <strong>{uiPanel.title}</strong>
          <div
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
              marginTop: 8,
            }}
          >
            {uiPanel.activities.map((a) => (
              <div
                key={a.id}
                style={{
                  minWidth: 240,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <img
                  alt={a.title}
                  src={a.image}
                  style={{ width: "100%", height: 120, objectFit: "cover" }}
                />
                <div style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{a.title}</div>
                  <div style={{ color: "#555" }}>
                    {a.date} • ${a.price}
                  </div>
                  <button
                    style={{ marginTop: 6 }}
                    onClick={async () => {
                      try {
                        await axios.post(`${API_BASE}/api/tasks`, {
                          type: "CONCIERGE",
                          details: `Book activity: ${a.title} on ${a.date}`,
                          socketId,
                        });
                      } catch (_) {}
                      const amt = a.price;
                      try {
                        const me = await axios
                          .get(`${API_BASE}/api/auth/me`, {
                            withCredentials: true,
                          })
                          .then((r) => r.data);
                        if (!me) {
                          setPendingAmount(amt);
                          setLoginPrompt(true);
                          return;
                        }
                      } catch (_) {}
                      setCheckout({ open: true, amount: amt });
                      setUiPanel(null);
                    }}
                  >
                    Book
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {loginPrompt && (
        <div
          style={{
            padding: 12,
            borderTop: "1px solid #eee",
            background: "#fafafa",
          }}
        >
          <strong>Login to continue</strong>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <button
              onClick={async () => {
                try {
                  await axios.post(
                    `${API_BASE}/api/auth/login`,
                    { email: loginEmail, password: loginPassword },
                    { withCredentials: true }
                  );
                  setLoginPrompt(false);
                  setMessages((p) => [
                    ...p,
                    {
                      sender: "bot",
                      text: "Logged in successfully. You can complete your order now.",
                    },
                  ]);
                } catch (err) {
                  setMessages((p) => [
                    ...p,
                    { sender: "bot", text: "Login failed. Please try again." },
                  ]);
                }
              }}
            >
              Login
            </button>
          </div>
        </div>
      )}
      {!profileSaved && (
        <div className="prearrival-form">
          <h3>Pre-Arrival Preferences</h3>
          <form onSubmit={submitProfile}>
            <div className="grid">
              <input
                placeholder="Name"
                value={profileForm.name}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, name: e.target.value })
                }
              />
              <input
                placeholder="Email"
                value={profileForm.email}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, email: e.target.value })
                }
              />
              <input
                placeholder="Phone"
                value={profileForm.phone}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, phone: e.target.value })
                }
              />
              <input
                placeholder="Language (e.g., en, hi)"
                value={profileForm.language}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, language: e.target.value })
                }
              />
              <input
                placeholder="Preferred room temp (°C)"
                value={profileForm.preferences.roomTemperatureCelsius}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    preferences: {
                      ...profileForm.preferences,
                      roomTemperatureCelsius: e.target.value,
                    },
                  })
                }
              />
              <input
                placeholder="Pillow type"
                value={profileForm.preferences.pillowType}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    preferences: {
                      ...profileForm.preferences,
                      pillowType: e.target.value,
                    },
                  })
                }
              />
              <input
                placeholder="Dietary preferences"
                value={profileForm.preferences.dietaryPreferences}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    preferences: {
                      ...profileForm.preferences,
                      dietaryPreferences: e.target.value,
                    },
                  })
                }
              />
              <input
                placeholder="Allergies"
                value={profileForm.preferences.allergies}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    preferences: {
                      ...profileForm.preferences,
                      allergies: e.target.value,
                    },
                  })
                }
              />
              <input
                placeholder="Accessibility needs"
                value={profileForm.preferences.accessibilityNeeds}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    preferences: {
                      ...profileForm.preferences,
                      accessibilityNeeds: e.target.value,
                    },
                  })
                }
              />
              <input
                placeholder="Other notes"
                value={profileForm.preferences.notes}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    preferences: {
                      ...profileForm.preferences,
                      notes: e.target.value,
                    },
                  })
                }
              />
            </div>
            <button type="submit" disabled={!isConnected}>
              Save Preferences
            </button>
          </form>
        </div>
      )}
      <form className="message-form" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isConnected ? "Type your message..." : "Connecting to server..."
          }
          disabled={!isConnected}
        />
        <button
          type="button"
          className={`mic-button ${isListening ? "listening" : ""}`}
          onClick={handleVoiceListen}
          disabled={!isConnected}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </button>
        <button type="submit" className="send-button" disabled={!isConnected}>
          Send
        </button>
      </form>
    </div>
  );
}

export default App;
