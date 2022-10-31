import * as React from "react";
import * as ReactDOM from "react-dom";
import "./ui.css";

declare function require(path: string): any;

const linkToMono =
  "https://www.figma.com/file/NHUtkk4ooD27kK4kF8kb9q/UI-Resources?node-id=1%3A450";

function App() {
  const [selection, setSelection] = React.useState(0);
  const [optimized, setOptimized] = React.useState(0);
  const [inProgress, setInProgress] = React.useState(false);
  const [failed, setFailed] = React.useState([]);
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
    onmessage = (event) => {
      if (event.data.pluginMessage.type === "selection") {
        setSelection(event.data.pluginMessage.value);
      }
      if (event.data.pluginMessage.type === "optimized") {
        setOptimized(event.data.pluginMessage.value);
      }
      if (event.data.pluginMessage.type === "failed") {
        setFailed(event.data.pluginMessage.value);
      }
      if (event.data.pluginMessage.type === "enable") {
        setEnabled(event.data.pluginMessage.value);
      }
    };
  }, []);
  React.useEffect(() => {
    if (inProgress && optimized === selection && selection !== 0) {
      setInProgress(false);
    }
  }, [optimized]);

  const inputRef = React.useRef<HTMLInputElement>(null);

  const onCreate = () => {
    setInProgress(true);
    parent.postMessage({ pluginMessage: { type: "optimize" } }, "*");
  };

  const onScan = () => {
    setOptimized(0);
    parent.postMessage({ pluginMessage: { type: "scan" } }, "*");
  };

  const onCancel = () => {
    parent.postMessage({ pluginMessage: { type: "cancel" } }, "*");
  };

  return (
    <main>
      <div className="content">
        <section className="counter">
          <h4>
            <button
              className="brand"
              disabled={inProgress}
              onClick={onScan}
              style={{ width: "100%" }}
            >
              Scan
            </button>
          </h4>
        </section>
        <section className="counter">
          <h4>Icons found:</h4> <span>{selection}</span>
        </section>
        <section className="counter">
          <h4>Icons updated:</h4> <span>{optimized}</span>
        </section>

        {failed.length ? (
          <>
            <section className="counter">
              <h4>Errors:</h4> <span>{failed.length}</span>
            </section>
            <ul className="counter">
              {failed.map((item, i) => (
                <li key={i}>
                  <a
                    className="error"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      parent.postMessage(
                        { pluginMessage: { type: "selectError", value: i } },
                        "*"
                      );
                    }}
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          ""
        )}
      </div>
      <footer>
        {inProgress ? <p>Please wait. Don't touch anything</p> : ""}
        {enabled ? (
          ""
        ) : (
          <p>
            You must add and select an instance of{" "}
            <a href={linkToMono}>Icon Mono</a> in the canvas
          </p>
        )}
        <button
          className="brand"
          onClick={onCreate}
          disabled={selection === 0 || inProgress || !enabled}
        >
          Replace
        </button>
        <button onClick={onCancel}>Cancel</button>
      </footer>
    </main>
  );
}

ReactDOM.render(<App />, document.getElementById("react-page"));
