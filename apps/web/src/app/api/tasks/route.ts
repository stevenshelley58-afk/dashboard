import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Task {
  task_id: string;
  account_id: string;
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

// GET /api/tasks - List all tasks for the account
export async function GET(request: NextRequest) {
  try {
    const accountId = await requireAccountId();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const includeArchived = searchParams.get("includeArchived") === "true";
    const pool = getDbPool();

    let sql = `
      SELECT task_id, account_id, title, description, status, priority, 
             due_date, completed_at, position, created_at, updated_at
      FROM tasks 
      WHERE account_id = $1
    `;
    const params: (string | boolean)[] = [accountId];

    if (status) {
      sql += ` AND status = $2`;
      params.push(status);
    } else if (!includeArchived) {
      sql += ` AND status != 'archived'`;
    }

    sql += ` ORDER BY position ASC, created_at DESC`;

    const result = await pool.query<Task>(sql, params);

    return NextResponse.json({ tasks: result.rows });
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const accountId = await requireAccountId();
    const body = await request.json();
    const { title, description, priority, due_date } = body;
    const pool = getDbPool();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Get max position for ordering
    const posResult = await pool.query<{ max_pos: number | null }>(
      `SELECT MAX(position) as max_pos FROM tasks WHERE account_id = $1 AND status != 'archived'`,
      [accountId]
    );
    const newPosition = (posResult.rows[0]?.max_pos ?? -1) + 1;

    const result = await pool.query<Task>(
      `INSERT INTO tasks (account_id, title, description, priority, due_date, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING task_id, account_id, title, description, status, priority, due_date, completed_at, position, created_at, updated_at`,
      [
        accountId,
        title.trim(),
        description || null,
        priority || "medium",
        due_date || null,
        newPosition,
      ]
    );

    return NextResponse.json({ task: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks - Update a task
export async function PATCH(request: NextRequest) {
  try {
    const accountId = await requireAccountId();
    const body = await request.json();
    const { task_id, title, description, status, priority, due_date, position } = body;
    const pool = getDbPool();

    if (!task_id) {
      return NextResponse.json(
        { error: "task_id is required" },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [accountId, task_id];
    let paramIndex = 3;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
      if (status === "done") {
        updates.push(`completed_at = NOW()`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(due_date);
    }
    if (position !== undefined) {
      updates.push(`position = $${paramIndex++}`);
      values.push(position);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const result = await pool.query<Task>(
      `UPDATE tasks SET ${updates.join(", ")}
       WHERE account_id = $1 AND task_id = $2
       RETURNING task_id, account_id, title, description, status, priority, due_date, completed_at, updated_at`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ task: result.rows[0] });
  } catch (error) {
    console.error("Failed to update task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks - Delete (archive) a task
export async function DELETE(request: NextRequest) {
  try {
    const accountId = await requireAccountId();
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("task_id");
    const hardDelete = searchParams.get("hard") === "true";
    const pool = getDbPool();

    if (!taskId) {
      return NextResponse.json(
        { error: "task_id is required" },
        { status: 400 }
      );
    }

    if (hardDelete) {
      await pool.query(
        `DELETE FROM tasks WHERE account_id = $1 AND task_id = $2`,
        [accountId, taskId]
      );
    } else {
      await pool.query(
        `UPDATE tasks SET status = 'archived' WHERE account_id = $1 AND task_id = $2`,
        [accountId, taskId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
