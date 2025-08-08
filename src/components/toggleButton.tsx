import React, { useState } from "react";

function ToggleButton({ onActivate, onDeactivate, classNames = "" }: {
  onActivate?: () => void;
  onDeactivate?: () => void;
  classNames?: string;}) {
  const [isOn, setIsOn] = useState(false);

  const handleToggle = () => {
    const newState = !isOn;
    setIsOn(newState);
    newState ? onActivate?.() : onDeactivate?.();
  };

  return (
    <button
      onClick={handleToggle}
      className={`${classNames} relative w-1 h-1 rounded-full flex items-center justify-center transition-colors duration-300 ease-in-out focus:outline-none outline-none focus:ring-offset-none ${
        isOn ? "bg-indigo-600" : "bg-gray-300"
      }`}
      style={{outline: "none"}}
    >
      <span
        className={`absolute w-6 h-6 ${
          isOn ? "bg-indigo-800" : "bg-gray-600"
        } rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
          isOn ? "translate-x-2" : "-translate-x-2"
        }`}
      />
    </button>
  );
}

export default ToggleButton;
