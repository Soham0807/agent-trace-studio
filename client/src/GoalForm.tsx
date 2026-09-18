import { useState } from "react";

export function GoalForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (goal: string) => void;
}) {
  const [goal, setGoal] = useState("Build a rate limiter middleware for an Express API");

  return (
    <form
      className="goal-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (goal.trim()) onSubmit(goal.trim());
      }}
    >
      <input
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Describe a goal for the agent team..."
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !goal.trim()}>
        {disabled ? "Running…" : "Run agents"}
      </button>
    </form>
  );
}
