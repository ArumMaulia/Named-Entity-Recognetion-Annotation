import { useState, useCallback, useRef } from "react";
const PREDEFINED_LABELS = [
  "B-ANATOMY",
  "I-ANATOMY",
  "B-DISEASE",
  "I-DISEASE",
  "B-FINDING",
  "I-FINDING",
  "B-MEASUREMENT",
  "I-MEASUREMENT",
  "B-PROCEDURE",
  "I-PROCEDURE",
  "O",
];
import { useVirtualizer } from "@tanstack/react-virtual";

const Row = ({ virtualItem, data }) => {
  const { tokens, handleLabelChange, handleToggleChecked, labelOptions } = data;
  const index = virtualItem.index;
  const token = tokens[index];

  return (
    <>
      <span className="row-number">{index + 1}</span>
      <span className="row-text">{token.text}</span>
      <select
        className="row-select"
        id={`row-select-${index}`}
        name={`row-select-${index}`}
        value={token.label}
        onChange={(e) => handleLabelChange(index, e.target.value)}
      >
        {!labelOptions.includes(token.label) && (
          <option value={token.label}>{token.label}</option>
        )}
        {labelOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <button
        className="row-button"
        aria-pressed={token.checked ? "true" : "false"}
        title={
          token.checked ? "Hapus centang" : "Tandai baris data sudah benar"
        }
        onClick={() => handleToggleChecked(index)}
      >
        ✓
      </button>
    </>
  );
};

function App() {
  const [tokens, setTokens] = useState([]);
  const [fileName, setFileName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [labelOptions, setLabelOptions] = useState(PREDEFINED_LABELS);

  // Logic for TanStack Virtual
  const parentRef = useRef();

  const rowVirtualizer = useVirtualizer({
    count: tokens.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45, // The height of a single row in pixels
    overscan: 5, // Render 5 extra items for smoother scrolling
  });

  // Function to handle the file upload and parse the CoNLL data
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      // Cleanup newlines
      const content = (e.target.result || "").replace(
        /\r\n?|\u2028|\u2029/g,
        "\n"
      );
      const lines = content.split("\n");

      const parsedTokens = [];
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line === "") continue; // skip sentence separators
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const text = parts[0];
          const label = parts[1]; // use second column as CoNLL label
          parsedTokens.push({ text, label, checked: false });
        }
      }

      // Derive unique label options from file content
      const fileLabels = Array.from(new Set(parsedTokens.map((t) => t.label)));
      // Keep predefined order, then add any new labels from file
      const extraLabels = fileLabels.filter(
        (l) => !PREDEFINED_LABELS.includes(l)
      );
      setLabelOptions([...PREDEFINED_LABELS, ...extraLabels]);
      setTokens(parsedTokens);
    };

    reader.readAsText(file);
  };

  // Function to update a token's label in application state
  // useCallback is used for optimization, so it isn't recreated on every render
  const handleLabelChange = useCallback((index, newLabel) => {
    setTokens((currentTokens) => {
      // Create a new array to ensure immutability
      const newTokens = [...currentTokens];
      newTokens[index] = { ...newTokens[index], label: newLabel };
      return newTokens;
    });
  }, []);

  const handleToggleChecked = useCallback((index) => {
    setTokens((currentTokens) => {
      const newTokens = [...currentTokens];
      newTokens[index] = {
        ...newTokens[index],
        checked: !newTokens[index].checked,
      };
      return newTokens;
    });
  }, []);

  const handleSave = useCallback(() => {
    if (tokens.length === 0) {
      alert("Tidak ada data untuk disimpan.");
      return;
    }

    setIsSaving(true);

    // Create a new worker instance
    const worker = new Worker("/saveWorker.js");

    // Define what to do when the worker sends the processed data back.
    worker.onmessage = (event) => {
      const conllString = event.data;

      // Create a "Blob", which is a file-like object
      const blob = new Blob([conllString], {
        type: "text/plain;charset=utf-8",
      });

      // Create a temporary URL for the Blob
      const url = URL.createObjectURL(blob);

      // Create a temporary link element to trigger the download
      const link = document.createElement("a");
      link.href = url;
      link.download = `annotated_${fileName || "output.conll"}`;
      document.body.appendChild(link);
      link.click();

      // Clean up by removing the link and revoking the URL
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsSaving(false);
      console.log("File berhasil disimpan!");

      // Important: terminate the worker to free up resources
      worker.terminate();
    };

    worker.onerror = (error) => {
      console.error("Error in worker:", error);
      setIsSaving(false);
      worker.terminate();
    };

    // Send the data to the worker to start processing.
    // Strip non-CoNLL fields before sending to worker to reduce payload
    worker.postMessage(tokens.map(({ text, label }) => ({ text, label })));
  }, [tokens, fileName]);

  return (
    <div className="container">
      <h1>CoNLL Annotation Tool</h1>
      <p>Alat untuk membantu validasi hasil anotasi CoNLL.</p>

      <div className="controls-container">
        <div className="file-input-container">
          <input
            type="file"
            id="file"
            accept=".conll,.txt"
            onChange={handleFileChange}
          />
          <label htmlFor="file" className="file-input-label">
            Unggah File
          </label>
          {fileName && <span className="file-name">{fileName}</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || tokens.length === 0}
          className="save-button"
        >
          {isSaving ? "Memroses..." : "Simpan file .conll"}
        </button>
      </div>

      <div className="list-container" ref={parentRef}>
        {tokens.length > 0 ? (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => (
              <div
                key={virtualItem.key}
                className={`row${
                  tokens[virtualItem.index]?.checked ? " checked" : ""
                }`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <Row
                  virtualItem={virtualItem}
                  data={{
                    tokens,
                    handleLabelChange,
                    handleToggleChecked,
                    labelOptions,
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="placeholder">
            <p>Mohon unggah file untuk mulai melakukan anotasi.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
