import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("designspace-root")!);
if (new URLSearchParams(location.search).get("view") === "screen") {
  void import("./designspace/Preview").then(({ default: Preview }) =>
    root.render(<Preview />),
  );
} else {
  void import("./designspace/Studio").then(({ default: Studio }) =>
    root.render(<Studio />),
  );
}
