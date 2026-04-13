import { useEffect, useState } from "react";
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://asianloopserver.onrender.com";

export default function BillsPage() {
  const [bills, setBills] = useState([]);
  const [expandedBills, setExpandedBills] = useState({});
  const [searchPrice, setSearchPrice] = useState("");
  const [filteredBills, setFilteredBills] = useState([]);

  useEffect(() => {
    // Initial fast load from local cache
    const saved = JSON.parse(localStorage.getItem("bills")) || [];
    saved.sort((a, b) => new Date(b.date) - new Date(a.date));
    setBills(saved);
    setFilteredBills(saved);

    // Fetch latest bills from server
    fetch(`${API_BASE_URL}/api/bills`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          data.sort((a, b) => new Date(b.date) - new Date(a.date));
          setBills(data);
          setFilteredBills(data);
          localStorage.setItem("bills", JSON.stringify(data));
        }
      })
      .catch((err) => console.error("Failed to fetch bills:", err));
  }, []);

  // Handle search by closest price
  const handlePriceSearch = (value) => {
    setSearchPrice(value);

    if (value.trim() === "") {
      setFilteredBills(bills);
      return;
    }

    const searchValue = parseFloat(value);
    if (isNaN(searchValue)) {
      setFilteredBills(bills);
      return;
    }

    // Find bills closest to the search price
    const sorted = [...bills].sort(
      (a, b) => Math.abs(a.total - searchValue) - Math.abs(b.total - searchValue)
    );
    setFilteredBills(sorted);
  };

  // Toggle expanded view for a bill
  const toggleBillExpand = (index) => {
    setExpandedBills((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

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
        <p className="text-xl font-bold mb-4 text-center">
          Rechnung
        </p>

        {/* Search Bar */}
        <div className="mb-5">
          <input
            type="number"
            placeholder="Suche nach Preis..."
            value={searchPrice}
            onChange={(e) => handlePriceSearch(e.target.value)}
            step="0.01"
            className="w-full border-2 border-gray-300 rounded-lg p-2 text-base focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Bills List */}
        <div className="space-y-3">
          {filteredBills.length === 0 ? (
            <p className="text-center text-gray-500 py-4">Keine Rechnungen gefunden</p>
          ) : (
            filteredBills.map((bill, index) => (
              <div
                key={index}
                className="border-2 border-gray-300 rounded-lg shadow-sm bg-white overflow-hidden"
              >
                {/* Collapsed Header - Click to expand */}
                <div
                  onClick={() => toggleBillExpand(index)}
                  className="cursor-pointer p-4 hover:bg-gray-50 transition-colors flex justify-between items-center"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-bold text-lg">Tisch {bill.table}</span>
                    {bill.method && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full text-white font-bold ${
                          bill.method === "Bar" ? "bg-green-500" : "bg-blue-500"
                        }`}
                      >
                        {bill.method}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-green-600">
                      {bill.total.toFixed(2)}€
                    </span>
                    <span className="text-xl">
                      {expandedBills[index] ? "▼" : "▶"}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedBills[index] && (
                  <div className="border-t-2 border-gray-300 p-4 bg-gray-50">
                    {/* Date */}
                    <div className="mb-3 pb-3 border-b border-gray-300">
                      <span className="text-sm text-gray-600">
                        {new Date(bill.date).toLocaleString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Items */}
                    <div className="space-y-2 mb-3">
                      {bill.items.map((item, i) => (
                        <div
                          key={i}
                          className="flex justify-between text-sm"
                        >
                          <span className="truncate w-[70%]">
                            {item.name}
                          </span>
                          <span className="font-medium">
                            {item.price}€
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="border-t-2 border-gray-300 pt-3 text-right">
                      <span className="font-bold text-green-700 text-lg">
                        Total: {bill.total.toFixed(2)}€
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

