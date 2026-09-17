import { createRoot } from "react-dom/client";
import { App } from "./App";
import { reloadIfStale } from "./api";

// The shell PAGE "index" is /group/app.pma/index?OpenPage. Derive the app path from the URL so
// the same bundle works unchanged in any copy of the template.
const appPath = window.location.pathname.replace(/\/[^/]*$/, "");

const el = document.getElementById("root");
if (el) createRoot(el).render(<App appPath={appPath} />);
reloadIfStale();
