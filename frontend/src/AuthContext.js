import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:5001" : "");

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/auth/me`, { withCredentials: true })
      .then((r) => {
        setUser(r.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const r = await axios.post(
      `${API_BASE}/api/auth/login`,
      { email, password },
      { withCredentials: true }
    );
    setUser(r.data);
    return r.data;
  };
  const signup = async (name, email, password) => {
    const r = await axios.post(
      `${API_BASE}/api/auth/signup`,
      { name, email, password },
      { withCredentials: true }
    );
    setUser(r.data);
    return r.data;
  };
  const logout = async () => {
    await axios.post(
      `${API_BASE}/api/auth/logout`,
      {},
      { withCredentials: true }
    );
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
