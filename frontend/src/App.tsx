import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Insights from "./pages/Insights";
import LogEntry from "./pages/LogEntry";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/log" element={<LogEntry />} />
        <Route path="/history" element={<History />} />
        <Route path="/insights" element={<Insights />} />
      </Routes>
    </Layout>
  );
}
