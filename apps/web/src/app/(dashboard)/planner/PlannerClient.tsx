"use client";

import { useState, useEffect, useCallback } from "react";

interface Task {
  task_id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "archived";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

type TaskFilter = "all" | "todo" | "in_progress" | "done";

const priorityColors = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const statusIcons = {
  todo: (
    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="10" r="7" />
    </svg>
  ),
  in_progress: (
    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2 2" strokeLinecap="round" />
    </svg>
  ),
  done: (
    <svg className="w-5 h-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  archived: (
    <svg className="w-5 h-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
      <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  ),
};

export default function PlannerClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Task["priority"]>("medium");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTaskTitle, priority: newTaskPriority }),
      });
      if (!res.ok) throw new Error("Failed to add task");
      const data = await res.json();
      setTasks((prev) => [...prev, data.task]);
      setNewTaskTitle("");
      setNewTaskPriority("medium");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setIsAdding(false);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, ...updates }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      const data = await res.json();
      setTasks((prev) =>
        prev.map((t) => (t.task_id === taskId ? data.task : t))
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks?task_id=${taskId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete task");
      setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const cycleStatus = (task: Task) => {
    const statusOrder: Task["status"][] = ["todo", "in_progress", "done"];
    const currentIndex = statusOrder.indexOf(task.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    updateTask(task.task_id, { status: nextStatus });
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "all") return task.status !== "archived";
    return task.status === filter;
  });

  const completedToday = tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completed_at &&
      new Date(t.completed_at).toDateString() === new Date().toDateString()
  ).length;

  const totalActive = tasks.filter((t) => t.status !== "archived" && t.status !== "done").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planner</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalActive} active • {completedToday} completed today
          </p>
        </div>
      </div>

      {/* Quick Add */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Add a new task... (press Enter)"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isAdding}
          />
          <div className="flex gap-2">
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as Task["priority"])}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <button
              onClick={addTask}
              disabled={isAdding || !newTaskTitle.trim()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isAdding ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "todo", "in_progress", "done"] as TaskFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {f === "all" ? "All" : f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Task List */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center">
            <p className="text-muted-foreground">
              {filter === "all"
                ? "No tasks yet. Add one above to get started!"
                : `No ${filter === "in_progress" ? "in progress" : filter} tasks.`}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.task_id}
              className={`bg-card rounded-lg border border-border p-4 flex items-start gap-3 group hover:border-primary/30 transition-colors ${
                task.status === "done" ? "opacity-60" : ""
              }`}
            >
              {/* Status Toggle */}
              <button
                onClick={() => cycleStatus(task)}
                className="flex-shrink-0 mt-0.5 hover:scale-110 transition-transform"
                title={`Click to change status (${task.status})`}
              >
                {statusIcons[task.status]}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {editingId === task.task_id ? (
                  <input
                    type="text"
                    defaultValue={task.title}
                    autoFocus
                    onBlur={(e) => updateTask(task.task_id, { title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateTask(task.task_id, { title: e.currentTarget.value });
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                ) : (
                  <p
                    className={`text-sm font-medium cursor-pointer ${
                      task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                    onClick={() => setEditingId(task.task_id)}
                  >
                    {task.title}
                  </p>
                )}
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {task.description}
                  </p>
                )}
                {task.due_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Due: {new Date(task.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Priority & Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
                  {task.priority}
                </span>
                <button
                  onClick={() => deleteTask(task.task_id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-all"
                  title="Delete task"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
