import { useEffect, useState } from "react";
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://asianloopserver.onrender.com";

export default function BillsPage() {
  const [bills, setBills] = useState([]);

  useEffect(() => {
    // Initial fast load from local cache
    const saved = JSON.parse(localStorage.getItem("bills")) || [];
    saved.sort((a, b) => new Date(b.date) - new Date(a.date));
    setBills(saved);

    // Fetch latest bills from server
    fetch(`${API_BASE_URL}/api/bills`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBills(data);
          localStorage.setItem("bills", JSON.stringify(data));
        }
      })
      .catch((err) => console.error("Failed to fetch bills:", err));
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div
        className="
          bg-white
          w-full
          h-full
          sm:h-[90vh]
          sm:max-w-md
          p-5
          rounded-none
          sm:rounded-xl
          overflow-y-auto
          text-base
        "
      >
        {/* Title */}
        <p className="text-xl font-bold mb-5 text-center">
          Rechnung
        </p>

        <div className="space-y-4">
          {bills.map((bill, index) => (
            <div
              key={index}
              className="border rounded-xl p-4 shadow-sm bg-white"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Tisch {bill.table}
                  {bill.method && (
                    <span className={`text-xs px-2 py-0.5 rounded-full text-white font-bold ${bill.method === "Bar" ? "bg-green-500" : "bg-blue-500"}`}>
                      {bill.method}
                    </span>
                  )}
                </h2>

                <span className="text-sm text-gray-500">
                  {new Date(bill.date).toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Items */}
              <div className="mt-2 space-y-1">
                {bill.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between border-b py-2 last:border-0"
                  >
                    <span className="truncate w-[70%] text-base">
                      {item.name}
                    </span>
                    <span className="font-medium text-base">
                      {item.price}€
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="text-right mt-3 font-bold text-green-700 text-lg">
                Total: {bill.total.toFixed(2)}€
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

