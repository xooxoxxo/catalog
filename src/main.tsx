import React from "react";
import ReactDOM from "react-dom/client";
import { Tooltip } from "@base-ui/react/tooltip";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Tooltip.Provider delay={400}>
      <App />
    </Tooltip.Provider>
  </React.StrictMode>,
);
