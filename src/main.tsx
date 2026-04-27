import ReactDOM from "react-dom/client";
import App from "./App";
import { syncComfortThemeClass } from "./lib/appearance";
import "./styles/globals.css";

syncComfortThemeClass();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);
