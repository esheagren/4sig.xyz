import { Routes, Route, Navigate } from "react-router-dom";
import IntervalGame from "./components/interval/IntervalGame";
import { ProfilePage } from "./pages/ProfilePage";
import "./App.css";
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<IntervalGame />} />
      <Route path="/share/:id" element={<Navigate to="/" replace />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
