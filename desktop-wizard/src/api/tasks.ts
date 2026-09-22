export interface BoardTask {
  id?: string;
  title?: string;
  [key: string]: unknown;
}

export interface BoardDoc {
  version?: number;
  title?: string;
  tasks?: BoardTask[];
  updatedAt?: string;
  [key: string]: unknown;
}

export function nextTaskId(tasks: BoardTask[]): string {
  let m = 0;
  for (const t of tasks) {
    const x = /^T-?(\d+)$/i.exec(String(t.id || ""));
    if (x) m = Math.max(m, Number(x[1]));
  }
  return "T-" + String(m + 1).padStart(3, "0");
}

export function newWizardTask(id: string, title: string, notes = ""): BoardTask {
  const now = new Date().toISOString();
  return {
    id,
    title,
    status: "todo",
    priority: "medium",
    source: "wizard",
    sourceRef: "AQWizard",
    entryId: "",
    tags: ["wizard"],
    notes,
    botAction: "none",
    botInstruction: "",
    comments: [],
    suggestedReply: "",
    due: null,
    assignee: "",
    checklist: [],
    progress: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: "AQWizard",
    chat: [],
    timeline: [],
    pendingSend: null,
    pendingTrash: false,
    boxNote: notes,
  };
}

export function mergeTaskIntoDoc(doc: BoardDoc, task: BoardTask): BoardDoc {
  const tasks = Array.isArray(doc.tasks) ? doc.tasks : [];
  return {
    ...doc,
    version: typeof doc.version === "number" ? doc.version : 1,
    title: doc.title || "Aqaar Command",
    tasks: [task, ...tasks],
    updatedAt: new Date().toISOString(),
  };
}
