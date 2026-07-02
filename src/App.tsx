import { Switch, Route } from "wouter";
import { Layout } from "./components/layout/Layout";
import { Toaster } from "sonner";
import Dashboard from "./pages/Dashboard";
import Treasury from "./pages/Treasury";
import Credentials from "./pages/Credentials";
import Settlements from "./pages/Settlements";
import Bridge from "./pages/Bridge";
import Audit from "./pages/Audit";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/treasury" component={Treasury} />
          <Route path="/credentials" component={Credentials} />
          <Route path="/settlements" component={Settlements} />
          <Route path="/bridge" component={Bridge} />
          <Route path="/audit" component={Audit} />
          <Route path="/settings" component={Settings} />
          <Route component={Dashboard} />
        </Switch>
      </Layout>
      <Toaster
        richColors
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          },
        }}
      />
    </>
  );
}
