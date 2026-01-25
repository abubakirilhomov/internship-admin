import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Layout/Sidebar";
import Header from "./components/Layout/Header";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Interns from "./pages/Interns";
import Mentors from "./pages/Mentors";
import Branches from "./pages/Branches";
import InternsRating from "./pages/InternsRating";
import Rules from "./pages/Rules";
import MentorDebt from "./pages/MentorDebt";
import ViolationsPage from "./pages/ViolationsPage";

const Layout = ({ children }) => {
  return (
    <div className="drawer lg:drawer-open">
      <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col">
        <Header />
        <main className="flex-1 bg-base-200 min-h-screen">{children}</main>
      </div>
      <Sidebar />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div data-theme="corporate" className="min-h-screen">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/interns/rating"
              element={
                <ProtectedRoute>
                  <Layout>
                    <InternsRating />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/interns"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Interns />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/mentors"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Mentors />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/branches"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Branches />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rules"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Rules />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/mentor-debt"
              element={
                <ProtectedRoute>
                  <Layout>
                    <MentorDebt />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/violations"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ViolationsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
