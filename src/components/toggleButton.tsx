import React, { useState } from "react";

function ToggleButton() {
  const [isOn, setIsOn] = useState(false); // State to manage the toggle status

  const handleToggle = () => {
    setIsOn(!isOn); // Toggle the state
  };

  return (
    <button
      onClick={handleToggle}
      className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
        ${isOn ? "bg-indigo-600" : "bg-gray-200"}`}
    >
      <span
        className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out
          ${isOn ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

export default ToggleButton;
