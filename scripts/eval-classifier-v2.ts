import fs from 'fs';
import path from 'path';

const cases = [
  { msg: "hi", history: [] },
  { msg: "help me research the best noise-cancelling headphones under $300", history: [ { role: 'user', content: 'hey' }, { role: 'model', content: 'Hey Mikhail. What are we working on?' } ] },
  { msg: "what about Sony vs Bose specifically?", history: [ { role: 'user', content: 'help me research the best noise-cancelling headphones under $300' }, { role: 'model', content: 'Here is some info on headphones...' } ] },
  { msg: "let's create a task instead: \"renew passport\" due next Friday", history: [ { role: 'user', content: 'what about Sony vs Bose specifically?' }, { role: 'model', content: 'Sony vs Bose differences...' } ] },
  { msg: "ok back to the headphones thing — did you decide between Sony and Bose?", history: [ { role: 'user', content: 'let\'s create a task instead: "renew passport" due next Friday' }, { role: 'model', content: 'Task created: Renew passport.' } ] },
  { msg: "delete the passport task", history: [ { role: 'user', content: 'ok back to the headphones thing — did you decide between Sony and Bose?' }, { role: 'model', content: 'I recommend the Sony WH-1000XM5.' } ] },
  { msg: "actually, tell me a fun fact about octopuses instead", history: [ { role: 'user', content: 'delete the passport task' }, { role: 'model', content: 'The following task is pending deletion: Renew passport. Confirm you want to delete this?' } ] },
  { msg: "yes", history: [ { role: 'user', content: 'actually, tell me a fun fact about octopuses instead' }, { role: 'model', content: 'Octopuses have three hearts and nine brains.' } ] },
  { msg: "create a task \"test router\" for monday 5pm, high priority", history: [] },
  { msg: "make it due tomorrow instead", history: [ { role: 'user', content: 'create a task "test router" for monday 5pm, high priority' }, { role: 'model', content: 'Task created.' } ] },
  { msg: "what's 15% of 340 plus 12% of 500", history: [] },
  { msg: "list my overdue tasks", history: [] },
  { msg: "sort my backlog into priorities and create tasks for the top 3", history: [] },
  { msg: "latest iphone price", history: [] },
  { msg: "draw a cat in a spacesuit", history: [] }
];

const oldPrompt = `You are a routing classifier. Output ONLY a JSON object, no prose:
{"category": "...", "complexity": "...", "action": ...}

category — exactly one of:
- PRIMARY: conversation, questions, advice, planning, math, writing, code snippets, and any request touching the user's tasks/notes/workspaces.
- WEB_SEARCH: needs current/live web data — news, prices, product comparisons, software versions, anything likely after 2024.
- RESEARCH: explicit request for exhaustive multi-source research.
- IMAGE_GEN: create/draw/generate an image or art.

complexity — "hard" ONLY for deep multi-step reasoning, tricky logic/math, or large multi-part work. Otherwise "normal".

action — true ONLY when completing the request needs TWO OR MORE tool operations (a lookup THEN a write, or several writes). ONE operation or zero operations = false. Count the operations, then decide:
- "hi" → 0 operations → false
- "create a task buy milk tomorrow 7pm high priority" → 1 operation (one create) → false
- "make it due tomorrow instead" → 1 operation (one update) → false
- "list my tasks" / "what's on my schedule" → 1 operation (one read) → false
- "delete this note" → 1 operation → false
- "create a task AND a note about it" → 2 operations → true
- "find my Flowr workspace and add a task there" → 2 operations (find, then create) → true
- "read this image and create a note from it" → 2 operations → true
- "reorganize my notes into folders by topic" → many operations → true

ATTACHMENTS: if this message has an attachment hint like "[2 images attached]", the user is very likely asking about that attachment right now — bias toward PRIMARY unless they clearly reference an unrelated external topic.
EXAMPLES (message → output):
"hi" → {"category":"PRIMARY","complexity":"normal","action":false}
"hello how are you?" → {"category":"PRIMARY","complexity":"normal","action":false}
"create a task \\"test router\\" for monday 5pm, high priority" → {"category":"PRIMARY","complexity":"normal","action":false}
"make it due tomorrow instead" → {"category":"PRIMARY","complexity":"normal","action":false}
"what's 15% of 340 plus 12% of 500" → {"category":"PRIMARY","complexity":"normal","action":false}
"list my overdue tasks" → {"category":"PRIMARY","complexity":"normal","action":false}
"find my flowr workspace and add a task there to review patch notes, then create a note" → {"category":"PRIMARY","complexity":"normal","action":true}
"sort my backlog into priorities and create tasks for the top 3" → {"category":"PRIMARY","complexity":"hard","action":true}
"help me design the architecture for my app's sync system" → {"category":"PRIMARY","complexity":"hard","action":false}
"latest iphone price" → {"category":"WEB_SEARCH","complexity":"normal","action":false}
"research the best budget LLMs and write a report in a note" → {"category":"RESEARCH","complexity":"normal","action":true}
"draw a cat in a spacesuit" → {"category":"IMAGE_GEN","complexity":"normal","action":false}`;

const newPrompt = `You are a routing classifier. Output ONLY a JSON object, no prose:
{"category": "...", "complexity": "...", "action": ..., "focus_shift": ...}

category — exactly one of:
- PRIMARY: conversation, questions, advice, planning, math, writing, code snippets, and any request touching the user's tasks/notes/workspaces.
- WEB_SEARCH: needs current/live web data — news, prices, product comparisons, software versions, anything likely after 2024.
- RESEARCH: explicit request for exhaustive multi-source research.
- IMAGE_GEN: create/draw/generate an image or art.

complexity — "hard" ONLY for deep multi-step reasoning, tricky logic/math, or large multi-part work. Otherwise "normal".

action — true ONLY when completing the request needs TWO OR MORE tool operations (a lookup THEN a write, or several writes). ONE operation or zero operations = false. Count the operations, then decide:
- "hi" → 0 operations → false
- "create a task buy milk tomorrow 7pm high priority" → 1 operation (one create) → false
- "make it due tomorrow instead" → 1 operation (one update) → false
- "list my tasks" / "what's on my schedule" → 1 operation (one read) → false
- "delete this note" → 1 operation → false
- "create a task AND a note about it" → 2 operations → true
- "find my Flowr workspace and add a task there" → 2 operations (find, then create) → true
- "read this image and create a note from it" → 2 operations → true
- "reorganize my notes into folders by topic" → many operations → true

focus_shift — null UNLESS the user shifted to a clearly different topic than immediately before. If so, a short (max 10 words) description of the NEW topic. Otherwise null. Do NOT set for follow-ups, clarifications, confirmations ("yes", "no"), continuations of the same task, or a message with no prior history to shift from (first message in a conversation).

ATTACHMENTS: if this message has an attachment hint like "[2 images attached]", the user is very likely asking about that attachment right now — bias toward PRIMARY unless they clearly reference an unrelated external topic.
EXAMPLES (message → output):
"hi" → {"category":"PRIMARY","complexity":"normal","action":false,"focus_shift":null}
"create a task \"test router\" for monday 5pm, high priority" → {"category":"PRIMARY","complexity":"normal","action":false,"focus_shift":null}
"make it due tomorrow instead" → {"category":"PRIMARY","complexity":"normal","action":false,"focus_shift":null}
"actually, tell me a fun fact about octopuses" (previous topic was deleting a task) → {"category":"PRIMARY","complexity":"normal","action":false,"focus_shift":"learning about octopuses"}
"what's 15% of 340 plus 12% of 500" → {"category":"PRIMARY","complexity":"normal","action":false,"focus_shift":"calculating a percentage"}
"list my overdue tasks" → {"category":"PRIMARY","complexity":"normal","action":false,"focus_shift":null}
"find my flowr workspace and add a task there to review patch notes, then create a note" → {"category":"PRIMARY","complexity":"normal","action":true,"focus_shift":null}
"sort my backlog into priorities and create tasks for the top 3" → {"category":"PRIMARY","complexity":"hard","action":true,"focus_shift":null}
"help me design the architecture for my app's sync system" → {"category":"PRIMARY","complexity":"hard","action":false,"focus_shift":null}
"latest iphone price" → {"category":"WEB_SEARCH","complexity":"normal","action":false,"focus_shift":null}
"what about Sony vs Bose specifically?" (asking for a fresh comparison, not previously discussed) → {"category":"WEB_SEARCH","complexity":"normal","action":false,"focus_shift":null}
"did you decide between Sony and Bose?" (recalling what YOU already said earlier in this conversation) → {"category":"PRIMARY","complexity":"normal","action":false,"focus_shift":null}
"research the best budget LLMs and write a report in a note" → {"category":"RESEARCH","complexity":"normal","action":true,"focus_shift":null}
"draw a cat in a spacesuit" → {"category":"IMAGE_GEN","complexity":"normal","action":false,"focus_shift":null}

Output the JSON object and NOTHING else.`;

const baselinePath = path.join(__dirname, 'eval-classifier-v2-baseline.json');

async function main() {
  const { runGroq } = await import('../src/lib/bot/providers/groq');
  
  const isRecordMode = process.argv.includes('--record-baseline');
  
  if (isRecordMode) {
    console.log("Recording baseline (3 runs per case)...");
    const baseline: Record<number, any> = {};
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const historyText = c.history.map((h: any) => h.role === 'user' ? "User: " + h.content : "Model: " + h.content).join('\n\n');
      const fullUserPrompt = historyText ? "[RECENT HISTORY]\n" + historyText + "\n\n[CURRENT REQUEST]\nUser: " + c.msg : "User: " + c.msg;
      
      console.log(`Case ${i + 1}: ${c.msg}`);
      const runs: any[] = [];
      for (let j = 0; j < 3; j++) {
        try {
          const resOld: any = await runGroq('llama-3.1-8b-instant', fullUserPrompt, oldPrompt, undefined, { temperature: 0.1 });
          const contentOld = typeof resOld === 'object' ? resOld.content : resOld;
          runs.push(JSON.parse(contentOld.match(/\{[\s\S]*?\}/)?.[0] || "{}"));
        } catch (e: any) {
          console.log(`  Run ${j + 1} failed: ${e.message}`);
          runs.push({});
        }
        await new Promise(r => setTimeout(r, 20000));
      }
      
      const allMatch = runs.length === 3 && 
        runs.every(r => r.category === runs[0].category && r.complexity === runs[0].complexity && r.action === runs[0].action);
        
      if (allMatch) {
        baseline[i] = runs[0];
        console.log(`  Stable baseline: cat=${runs[0].category}, comp=${runs[0].complexity}, act=${runs[0].action}`);
      } else {
        baseline[i] = null;
        console.log(`  Unstable baseline! Runs disagreed.`);
      }
    }
    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    console.log("Baseline saved to " + baselinePath);
    return;
  }
  
  if (!fs.existsSync(baselinePath)) {
    console.error("Baseline file not found. Run with --record-baseline first.");
    process.exit(1);
  }
  
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  let regressions = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    
    const historyText = c.history.map((h: any) => h.role === 'user' ? "User: " + h.content : "Model: " + h.content).join('\n\n');
    const fullUserPrompt = historyText ? "[RECENT HISTORY]\n" + historyText + "\n\n[CURRENT REQUEST]\nUser: " + c.msg : "User: " + c.msg;

    try {
      const resNew: any = await runGroq('llama-3.1-8b-instant', fullUserPrompt, newPrompt, undefined, { temperature: 0.1 });
      const contentNew = typeof resNew === 'object' ? resNew.content : resNew;
      
      const parsedNew = JSON.parse(contentNew.match(/\{[\s\S]*?\}/)?.[0] || "{}");
      const base = baseline[i];
      
      console.log("Case " + (i + 1) + ": " + c.msg);
      
      if (!base) {
        console.log("  ⚠️ NO STABLE BASELINE — old prompt itself is inconsistent on this case; visually inspect new output for sanity, cannot auto-detect regression");
        console.log("     New: cat=" + parsedNew.category + ", comp=" + parsedNew.complexity + ", act=" + parsedNew.action);
      } else {
        const categoryMatch = base.category === parsedNew.category;
        const complexityMatch = base.complexity === parsedNew.complexity;
        const actionMatch = base.action === parsedNew.action;
        
        const isRegression = !categoryMatch || !complexityMatch || !actionMatch;
        
        if (isRegression) {
          console.log("  ❌ REGRESSION DETECTED");
          console.log("     Old: cat=" + base.category + ", comp=" + base.complexity + ", act=" + base.action);
          console.log("     New: cat=" + parsedNew.category + ", comp=" + parsedNew.complexity + ", act=" + parsedNew.action);
          regressions++;
        } else {
          console.log("  ✅ Match: cat=" + base.category + ", comp=" + base.complexity + ", act=" + base.action);
        }
      }
      
      console.log("     Focus Shift: " + parsedNew.focus_shift);
      console.log('');
      
    } catch (e: any) {
      console.log("Case " + (i + 1) + " failed to run: " + e.message);
    }

    await new Promise(r => setTimeout(r, 20000));
  }
  
  if (regressions > 0) {
    console.log("\nFailed: " + regressions + " regressions found.");
  } else {
    console.log("\nSuccess: 0 regressions found.");
  }
}

main().catch(console.error);
