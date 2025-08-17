import React, { useState, useEffect } from "react";
import axios from "axios";
import io from "socket.io-client";
import "./Dashboard.css";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:5001" : "");
const socket = io(API_BASE || undefined);

function Dashboard() {
  const [bookings, setBookings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [activeTab, setActiveTab] = useState("bookings");
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [menu, setMenu] = useState([]);
  const [bookingPage, setBookingPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const pageSize = 10;
  const [availability, setAvailability] = useState([]);
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guests, setGuests] = useState(2);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bookingsRes = await axios.get(`${API_BASE}/api/chat/bookings`);
        setBookings(bookingsRes.data);
        const ordersRes = await axios.get(`${API_BASE}/api/chat/room-service`);
        setOrders(ordersRes.data);
        const tasksRes = await axios.get(`${API_BASE}/api/tasks`);
        setTasks(tasksRes.data);
        const profilesRes = await axios.get(`${API_BASE}/api/profiles`);
        setProfiles(profilesRes.data);
        const docsRes = await axios.get(`${API_BASE}/api/documents`);
        setDocs(docsRes.data);
        const menuRes = await axios.get(`${API_BASE}/api/menu`);
        setMenu(menuRes.data);
      } catch (error) {
        console.error("Could not fetch initial data", error);
      }
    };

    fetchData();

    socket.on("new_booking", (newBooking) => {
      setBookings((prev) => [newBooking, ...prev]);
    });

    socket.on("new_room_service", (newOrder) => {
      setOrders((prev) => [newOrder, ...prev]);
    });

    socket.on("new_task", (newTask) => {
      setTasks((prev) => [newTask, ...prev]);
    });

    socket.on("task_status_updated", (updatedTask) => {
      setTasks((prev) =>
        prev.map((t) => (t._id === updatedTask._id ? updatedTask : t))
      );
    });

    socket.on("profile_updated", (profile) => {
      setProfiles((prev) => [profile, ...prev]);
    });

    socket.on("booking_status_updated", (updatedBooking) => {
      setBookings((prev) =>
        prev.map((b) => (b._id === updatedBooking._id ? updatedBooking : b))
      );
    });

    socket.on("room_service_status_updated", (updatedOrder) => {
      setOrders((prev) =>
        prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o))
      );
    });

    return () => {
      socket.off("new_booking");
      socket.off("new_room_service");
      socket.off("booking_status_updated");
      socket.off("room_service_status_updated");
      socket.off("new_task");
      socket.off("task_status_updated");
      socket.off("profile_updated");
    };
  }, []);

  const handleBookingStatusUpdate = async (id, status) => {
    try {
      await axios.put(`${API_BASE}/api/chat/bookings/${id}`, { status });
    } catch (error) {
      console.error("Failed to update booking status", error);
      alert("Failed to update booking status.");
    }
  };

  const handleRoomServiceStatusUpdate = async (id, status) => {
    try {
      await axios.put(`${API_BASE}/api/chat/room-service/${id}`, { status });
    } catch (error) {
      console.error("Failed to update room service status", error);
      alert("Failed to update room service status.");
    }
  };

  const handleTaskStatusUpdate = async (id, status) => {
    try {
      await axios.put(`${API_BASE}/api/tasks/${id}`, {
        status,
      });
    } catch (error) {
      console.error("Failed to update task status", error);
      alert("Failed to update task status.");
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Staff Dashboard</h1>
        {/* <p>Real-time Hotel Operations</p> */}
      </header>
      <div className="dashboard-tabs">
        <button
          className={activeTab === "bookings" ? "tab active" : "tab"}
          onClick={() => setActiveTab("bookings")}
        >
          Bookings
        </button>
        <button
          className={activeTab === "orders" ? "tab active" : "tab"}
          onClick={() => setActiveTab("orders")}
        >
          Room Service
        </button>
        <button
          className={activeTab === "tasks" ? "tab active" : "tab"}
          onClick={() => setActiveTab("tasks")}
        >
          Tasks
        </button>
        <button
          className={activeTab === "guests" ? "tab active" : "tab"}
          onClick={() => setActiveTab("guests")}
        >
          Guests
        </button>
        <button
          className={activeTab === "docs" ? "tab active" : "tab"}
          onClick={() => setActiveTab("docs")}
        >
          Documents
        </button>
        <button
          className={activeTab === "menu" ? "tab active" : "tab"}
          onClick={() => setActiveTab("menu")}
        >
          Menu
        </button>
        <button
          className={activeTab === "availability" ? "tab active" : "tab"}
          onClick={() => setActiveTab("availability")}
        >
          Availability
        </button>
      </div>
      <main className="dashboard-main">
        {activeTab === "bookings" && (
          <div className="dashboard-section">
            <h2>Booking Requests</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Request Details</th>
                    <th>Status</th>
                    <th>Received At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings
                    .slice((bookingPage - 1) * pageSize, bookingPage * pageSize)
                    .map((booking) => (
                      <tr key={booking._id}>
                        <td>{booking.details}</td>
                        <td>
                          <span
                            className={`status status-${booking.status.toLowerCase()}`}
                          >
                            {booking.status}
                          </span>
                        </td>
                        <td>{new Date(booking.createdAt).toLocaleString()}</td>
                        <td>
                          {booking.status === "Pending" ? (
                            <div className="action-buttons">
                              <button
                                onClick={() =>
                                  handleBookingStatusUpdate(
                                    booking._id,
                                    "Approved"
                                  )
                                }
                                className="btn-approve"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  handleBookingStatusUpdate(
                                    booking._id,
                                    "Declined"
                                  )
                                }
                                className="btn-decline"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div className="pagination-footer">
                <button
                  disabled={bookingPage === 1}
                  onClick={() => setBookingPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span>
                  Page {bookingPage} /{" "}
                  {Math.max(1, Math.ceil(bookings.length / pageSize))}
                </span>
                <button
                  disabled={
                    bookingPage >= Math.ceil(bookings.length / pageSize)
                  }
                  onClick={() => setBookingPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === "orders" && (
          <div className="dashboard-section">
            <h2>Room Service Orders</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Order Details</th>
                    <th>Status</th>
                    <th>Received At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .slice((orderPage - 1) * pageSize, orderPage * pageSize)
                    .map((order) => (
                      <tr key={order._id}>
                        <td>{order.details}</td>
                        <td>
                          <span
                            className={`status status-${order.status.toLowerCase()}`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td>{new Date(order.createdAt).toLocaleString()}</td>
                        <td>
                          {order.status === "Pending" ? (
                            <div className="action-buttons">
                              <button
                                onClick={() =>
                                  handleRoomServiceStatusUpdate(
                                    order._id,
                                    "Approved"
                                  )
                                }
                                className="btn-approve"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  handleRoomServiceStatusUpdate(
                                    order._id,
                                    "Declined"
                                  )
                                }
                                className="btn-decline"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div className="pagination-footer">
                <button
                  disabled={orderPage === 1}
                  onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span>
                  Page {orderPage} /{" "}
                  {Math.max(1, Math.ceil(orders.length / pageSize))}
                </span>
                <button
                  disabled={orderPage >= Math.ceil(orders.length / pageSize)}
                  onClick={() => setOrderPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === "tasks" && (
          <div className="dashboard-section">
            <h2>Tasks</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>Received At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task._id}>
                      <td>{task.type}</td>
                      <td>{task.details}</td>
                      <td>
                        <span
                          className={`status status-${task.status.toLowerCase()}`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td>{new Date(task.createdAt).toLocaleString()}</td>
                      <td>
                        {task.status === "Pending" ? (
                          <div className="action-buttons">
                            <button
                              onClick={() =>
                                handleTaskStatusUpdate(task._id, "Approved")
                              }
                              className="btn-approve"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() =>
                                handleTaskStatusUpdate(task._id, "Declined")
                              }
                              className="btn-decline"
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === "guests" && (
          <div className="dashboard-section">
            <h2>Guest Profiles (Latest)</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Language</th>
                    <th>Preferences</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p._id}>
                      <td>{p.name || "-"}</td>
                      <td>{p.phone || "-"}</td>
                      <td>{p.language || "-"}</td>
                      <td>{p.preferences?.notes || "-"}</td>
                      <td>{new Date(p.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === "docs" && (
          <div className="dashboard-section">
            <h2>Documents</h2>
            <div className="table-container" style={{ padding: 16 }}>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target;
                  const data = new FormData(form);
                  setUploading(true);
                  try {
                    const res = await axios.post(
                      `${API_BASE}/api/documents`,
                      data
                    );
                    setDocs((prev) => [res.data, ...prev]);
                    form.reset();
                  } catch (err) {
                    alert("Upload failed");
                  } finally {
                    setUploading(false);
                  }
                }}
              >
                <input name="title" placeholder="Title" required />
                <select name="category" defaultValue="OTHER">
                  <option value="MENU">Menu</option>
                  <option value="PHONE_EXTENSIONS">Phone Extensions</option>
                  <option value="GUIDE">Guide</option>
                  <option value="OTHER">Other</option>
                </select>
                <input name="file" type="file" required />
                <button type="submit" disabled={uploading}>
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </form>
              <ul>
                {docs.map((d) => (
                  <li key={d._id}>
                    <a
                      href={`${API_BASE}${d.filePath}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {d.title}
                    </a>
                    <span style={{ marginLeft: 8 }}>({d.category})</span>
                    <button
                      style={{ marginLeft: 12 }}
                      onClick={async () => {
                        try {
                          await axios.delete(
                            `${API_BASE}/api/documents/${d._id}`
                          );
                          setDocs((prev) =>
                            prev.filter((x) => x._id !== d._id)
                          );
                        } catch (e) {
                          alert("Delete failed");
                        }
                      }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {activeTab === "menu" && (
          <div className="dashboard-section">
            <h2>Menu Editor</h2>
            <div className="table-container" style={{ padding: 16 }}>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target;
                  const payload = {
                    category: form.category.value,
                    name: form.name.value,
                    price: parseFloat(form.price.value),
                    available: form.available.checked,
                  };
                  if (!payload.name || Number.isNaN(payload.price)) {
                    alert("Enter valid name and price");
                    return;
                  }
                  try {
                    const res = await axios.post(
                      `${API_BASE}/api/menu`,
                      payload
                    );
                    setMenu((prev) => [...prev, res.data]);
                    form.reset();
                  } catch (e) {
                    alert("Failed to add item");
                  }
                }}
              >
                <input
                  name="category"
                  placeholder="Category (e.g., Drinks)"
                  required
                />
                <input name="name" placeholder="Item name" required />
                <input
                  name="price"
                  placeholder="Price"
                  type="number"
                  step="0.01"
                  required
                />
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <input name="available" type="checkbox" defaultChecked />{" "}
                  Available
                </label>
                <button type="submit">Add</button>
              </form>
              <table style={{ marginTop: 12, width: "100%" }}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Available</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {menu.map((m) => (
                    <tr key={m._id}>
                      <td>{m.category}</td>
                      <td>{m.name}</td>
                      <td>${m.price.toFixed(2)}</td>
                      <td>{m.available ? "Yes" : "No"}</td>
                      <td>
                        <button
                          onClick={async () => {
                            try {
                              const updated = await axios.put(
                                `${API_BASE}/api/menu/${m._id}`,
                                { available: !m.available }
                              );
                              setMenu((prev) =>
                                prev.map((x) =>
                                  x._id === m._id ? updated.data : x
                                )
                              );
                            } catch (_) {
                              alert("Update failed");
                            }
                          }}
                        >
                          {m.available ? "Disable" : "Enable"}
                        </button>
                        <button
                          style={{ marginLeft: 8 }}
                          onClick={async () => {
                            try {
                              await axios.delete(
                                `${API_BASE}/api/menu/${m._id}`
                              );
                              setMenu((prev) =>
                                prev.filter((x) => x._id !== m._id)
                              );
                            } catch (_) {
                              alert("Delete failed");
                            }
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === "availability" && (
          <div className="dashboard-section">
            <h2>Room Availability & Quotes</h2>
            <div className="table-container" style={{ padding: 16 }}>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const res = await axios.get(
                      `${API_BASE}/api/bookings/availability`,
                      { params: { checkin, checkout, guests } }
                    );
                    setAvailability(res.data);
                  } catch (_) {
                    alert("Failed to fetch availability");
                  }
                }}
              >
                <input
                  type="date"
                  value={checkin}
                  onChange={(e) => setCheckin(e.target.value)}
                  required
                />
                <input
                  type="date"
                  value={checkout}
                  onChange={(e) => setCheckout(e.target.value)}
                  required
                />
                <input
                  type="number"
                  min="1"
                  value={guests}
                  onChange={(e) =>
                    setGuests(parseInt(e.target.value || "1", 10))
                  }
                />
                <button type="submit">Search</button>
              </form>
              {availability.length > 0 && (
                <table style={{ marginTop: 12, width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Capacity</th>
                      <th>Price/Night</th>
                      <th>Nights</th>
                      <th>Total</th>
                      <th>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availability.map((a, idx) => (
                      <tr key={idx}>
                        <td>{a.type}</td>
                        <td>{a.capacity}</td>
                        <td>${a.pricePerNight.toFixed(2)}</td>
                        <td>{a.totalNights}</td>
                        <td>${a.total.toFixed(2)}</td>
                        <td>{a.available ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
