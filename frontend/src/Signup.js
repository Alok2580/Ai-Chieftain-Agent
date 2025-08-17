import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./Auth.css";

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await signup(name, email, password);
      nav("/");
    } catch (err) {
      setError(err?.response?.data?.message || "Signup failed");
    }
  };
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h2 className="auth-title">Create account</h2>
        <div className="auth-sub">Start managing your hotel today</div>
        <form onSubmit={onSubmit}>
          <input
            className="auth-input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="auth-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-btn" type="submit">
            Create account
          </button>
        </form>
        <div className="auth-footer">
          Have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}
