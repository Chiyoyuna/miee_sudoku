const boardEl = document.getElementById('board');
const timerEl = document.getElementById('timer');
const mistakesEl = document.getElementById('mistakes');
const difficultyEl = document.getElementById('difficulty');
const notesBtn = document.getElementById('notesBtn');
const notesIndicator = document.getElementById('notesIndicator');
const undoBtn = document.getElementById('undoBtn');
const eraseBtn = document.getElementById('eraseBtn');
const hintBtn = document.getElementById('hintBtn');
const newGameBtn = document.getElementById('newGameBtn');
const newGameTop = document.getElementById('newGameTop');
const pauseBtn = document.getElementById('pauseBtn');

const winModal = document.getElementById('winModal');
const loseModal = document.getElementById('loseModal');
const confirmModal = document.getElementById('confirmModal');
const hintModal = document.getElementById('hintModal');
const bestScoreEl = document.getElementById('bestScore');
const diffPills = document.querySelectorAll('.diff-pill');
const customBlocksWrap = document.getElementById('customBlocksWrap');
const blocksRange = document.getElementById('blocksRange');
const blocksVal = document.getElementById('blocksVal');

let solution = [];
let puzzle = [];
let board = [];
let notes = [];
let fixed = [];
let history = [];
let selected = null;
let mistakes = 0;
const maxMistakes = 3;
let isNotesMode = false;
let timerInterval = null;
let seconds = 0;
let isPaused = false;
let gameOver = false;
let highlightedNumber = null; // for numpad highlight
let celebratedRows = new Set();
let celebratedCols = new Set();
let celebratedBoxes = new Set();

const DIFFICULTY_CLUES = {
  easy: 40,     // cells to remove
  medium: 50,
  hard: 58,
  expert: 64
};

// ---------- Sudoku Generator ----------
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function createEmptyBoard(){
  return Array.from({length:9},()=>Array(9).fill(0));
}
function isValid(board,r,c,val){
  for(let i=0;i<9;i++){
    if(board[r][i]===val) return false;
    if(board[i][c]===val) return false;
  }
  const br=Math.floor(r/3)*3, bc=Math.floor(c/3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) if(board[br+i][bc+j]===val) return false;
  return true;
}
function solveBoard(board){
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      if(board[r][c]===0){
        const nums=shuffle([1,2,3,4,5,6,7,8,9]);
        for(const n of nums){
          if(isValid(board,r,c,n)){
            board[r][c]=n;
            if(solveBoard(board)) return true;
            board[r][c]=0;
          }
        }
        return false;
      }
    }
  }
  return true;
}
function generateSolved(){
  const b=createEmptyBoard();
  solveBoard(b);
  return b;
}
function generatePuzzle(difficulty){
  const sol=generateSolved();
  const puz=sol.map(row=>[...row]);
  let cellsToRemove = DIFFICULTY_CLUES[difficulty];
  if(difficulty==='custom'){
    cellsToRemove = parseInt(blocksRange ? blocksRange.value : 50, 10);
  }
  if(cellsToRemove==null) cellsToRemove = 50;
  cellsToRemove = Math.max(20, Math.min(64, cellsToRemove));
  let removed=0;
  const positions=[];
  for(let r=0;r<9;r++) for(let c=0;c<9;c++) positions.push([r,c]);
  shuffle(positions);
  for(const [r,c] of positions){
    if(removed>=cellsToRemove) break;
    puz[r][c]=0;
    removed++;
  }
  return {sol,puz};
}

// ---------- Best Score (localStorage) ----------
function getDifficultyKey(){
  const d = difficultyEl.value;
  if(d==='custom' && blocksRange) return `custom_${blocksRange.value}`;
  return d;
}
function formatTime(sec){
  const m=String(Math.floor(sec/60)).padStart(2,'0');
  const s=String(sec%60).padStart(2,'0');
  return `${m}:${s}`;
}
function loadBest(key){
  try{ const v = localStorage.getItem(`sudoku_best_${key}`); return v ? parseInt(v,10) : null; } catch(e){ return null; }
}
function saveBest(key, sec){
  try{ localStorage.setItem(`sudoku_best_${key}`, String(sec)); } catch(e){}
}
function updateBestDisplay(){
  if(!bestScoreEl) return;
  const key = getDifficultyKey();
  const best = loadBest(key);
  const strong = bestScoreEl.querySelector('strong');
  if(best!=null){
    if(strong) strong.textContent = formatTime(best);
    bestScoreEl.classList.add('is-best');
    bestScoreEl.title = `Best for ${key}: ${formatTime(best)} — try to beat it!`;
  } else {
    if(strong) strong.textContent = '—';
    bestScoreEl.classList.remove('is-best');
    bestScoreEl.title = 'No best yet — finish a game to set one!';
  }
}
function updateDifficultyPills(){
  const cur = difficultyEl.value;
  diffPills.forEach(p=> p.classList.toggle('active', p.dataset.diff===cur));
  if(customBlocksWrap){
    if(cur==='custom') customBlocksWrap.classList.remove('hidden');
    else customBlocksWrap.classList.add('hidden');
  }
  if(blocksVal && blocksRange) blocksVal.textContent = blocksRange.value;
}

// ---------- Celebration helpers ----------
function isRowComplete(r){
  for(let c=0;c<9;c++) if(board[r][c]===0 || board[r][c]!==solution[r][c]) return false;
  return true;
}
function isColComplete(c){
  for(let r=0;r<9;r++) if(board[r][c]===0 || board[r][c]!==solution[r][c]) return false;
  return true;
}
function isBoxComplete(boxIdx){
  const br=Math.floor(boxIdx/3)*3, bc=(boxIdx%3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++){
    const r=br+i, c=bc+j;
    if(board[r][c]===0 || board[r][c]!==solution[r][c]) return false;
  }
  return true;
}
function spawnSparkles(cell){
  const positions = [{l:'12%',t:'12%'},{l:'68%',t:'18%'},{l:'22%',t:'72%'},{l:'75%',t:'68%'}];
  positions.forEach((pos,i)=>{
    const sp=document.createElement('span');
    sp.className='sparkle';
    sp.style.left=pos.l;
    sp.style.top=pos.t;
    sp.style.animationDelay=`${i*0.07}s`;
    sp.style.transform=`rotate(${i*18}deg)`;
    cell.appendChild(sp);
  });
}
function celebrateCells(cells){
  cells.forEach((cell,idx)=>{
    if(!cell) return;
    cell.classList.remove('celebrate');
    void cell.offsetWidth;
    cell.style.animationDelay = `${idx*0.045}s`;
    cell.classList.add('celebrate');
    spawnSparkles(cell);
    setTimeout(()=>{ cell.classList.remove('celebrate'); cell.style.animationDelay=''; const sps=cell.querySelectorAll('.sparkle'); sps.forEach(s=>s.remove()); }, 1200);
  });
}
function celebrateRow(r){
  const cells=[];
  for(let c=0;c<9;c++) cells.push(boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`));
  celebrateCells(cells);
}
function celebrateCol(c){
  const cells=[];
  for(let r=0;r<9;r++) cells.push(boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`));
  celebrateCells(cells);
}
function celebrateBox(boxIdx){
  const br=Math.floor(boxIdx/3)*3, bc=(boxIdx%3)*3;
  const cells=[];
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) cells.push(boardEl.querySelector(`[data-r="${br+i}"][data-c="${bc+j}"]`));
  celebrateCells(cells);
}
function checkAndCelebrateLines(){
  if(gameOver || isPaused) return;
  // rows
  for(let r=0;r<9;r++){
    const complete=isRowComplete(r);
    if(complete && !celebratedRows.has(r)){
      celebratedRows.add(r);
      celebrateRow(r);
      if(navigator.vibrate) navigator.vibrate(35);
    } else if(!complete && celebratedRows.has(r)){
      celebratedRows.delete(r);
    }
  }
  // cols
  for(let c=0;c<9;c++){
    const complete=isColComplete(c);
    if(complete && !celebratedCols.has(c)){
      celebratedCols.add(c);
      celebrateCol(c);
      if(navigator.vibrate) navigator.vibrate(35);
    } else if(!complete && celebratedCols.has(c)){
      celebratedCols.delete(c);
    }
  }
  // boxes
  for(let b=0;b<9;b++){
    const complete=isBoxComplete(b);
    if(complete && !celebratedBoxes.has(b)){
      celebratedBoxes.add(b);
      celebrateBox(b);
      if(navigator.vibrate) navigator.vibrate([30,40,30]);
    } else if(!complete && celebratedBoxes.has(b)){
      celebratedBoxes.delete(b);
    }
  }
}

// ---------- Game Init ----------
function initGame(difficulty){
  const {sol,puz}=generatePuzzle(difficulty);
  solution=sol;
  puzzle=puz;
  board=puz.map(r=>[...r]);
  fixed=puz.map(r=>r.map(v=>v!==0));
  notes=Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
  history=[];
  selected=null;
  highlightedNumber=null;
  mistakes=0;
  seconds=0;
  isPaused=false;
  gameOver=false;
  isNotesMode=false;
  celebratedRows=new Set();
  celebratedCols=new Set();
  celebratedBoxes=new Set();
  updateNotesButton();
  updateMistakes();
  updateTimer();
  updateBestDisplay();
  updateDifficultyPills();
  startTimer();
  hideAllModals();
  renderBoard();
  updateNumpadState();
}

function cloneNotes(){
  return notes.map(row=>row.map(s=>new Set(s)));
}

// ---------- Timer ----------
function startTimer(){
  clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    if(isPaused || gameOver) return;
    seconds++;
    updateTimer();
  },1000);
}
function updateTimer(){
  const m=String(Math.floor(seconds/60)).padStart(2,'0');
  const s=String(seconds%60).padStart(2,'0');
  timerEl.textContent=`${m}:${s}`;
}
function togglePause(){
  if(gameOver) return;
  isPaused=!isPaused;
  pauseBtn.textContent=isPaused?'▶':'⏸';
  boardEl.style.opacity=isPaused?'0.15':'1';
  boardEl.style.pointerEvents=isPaused?'none':'auto';
}

// ---------- Sound & Vibration ----------
let audioCtx=null;
function getAudioCtx(){
  if(!audioCtx){
    try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ audioCtx=null; }
  }
  return audioCtx;
}
function playWrongSound(){
  const ctx=getAudioCtx();
  if(!ctx) return;
  if(ctx.state==='suspended') ctx.resume();
  const o=ctx.createOscillator();
  const g=ctx.createGain();
  o.type='square';
  o.frequency.value=180;
  const o2=ctx.createOscillator();
  const g2=ctx.createGain();
  o2.type='sawtooth';
  o2.frequency.value=120;
  o.connect(g); g.connect(ctx.destination);
  o2.connect(g2); g2.connect(ctx.destination);
  const now=ctx.currentTime;
  g.gain.setValueAtTime(0.35, now);
  g.gain.exponentialRampToValueAtTime(0.01, now+0.35);
  g2.gain.setValueAtTime(0.25, now);
  g2.gain.exponentialRampToValueAtTime(0.01, now+0.35);
  o.start(now); o.stop(now+0.35);
  o2.start(now); o2.stop(now+0.35);
  // second buzz
  setTimeout(()=>{
    if(!ctx) return;
    const o3=ctx.createOscillator();
    const g3=ctx.createGain();
    o3.frequency.value=140; o3.type='square';
    o3.connect(g3); g3.connect(ctx.destination);
    const t=ctx.currentTime;
    g3.gain.setValueAtTime(0.3, t);
    g3.gain.exponentialRampToValueAtTime(0.01, t+0.25);
    o3.start(t); o3.stop(t+0.25);
  },120);
}
function triggerWrongFeedback(){
  playWrongSound();
  if(navigator.vibrate) navigator.vibrate([220,80,220]);
}

// ---------- Rendering ----------
function renderBoard(){
  boardEl.innerHTML='';
  // determine the number to highlight: highlightedNumber (from numpad) takes priority, else selected cell value
  let highlightNum = highlightedNumber;
  if(selected){
    const sv = board[selected.r][selected.c];
    if(sv!==0) highlightNum = sv;
  }
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.r=r;
      cell.dataset.c=c;

      // highlight states - row/col/box from selected
      if(selected && selected.r===r && selected.c===c) cell.classList.add('selected');
      else if(selected){
        const sr=selected.r, sc=selected.c;
        const sameRow = r===sr;
        const sameCol = c===sc;
        const sameBox = Math.floor(r/3)===Math.floor(sr/3) && Math.floor(c/3)===Math.floor(sc/3);
        if(sameRow || sameCol || sameBox) cell.classList.add('highlight');
      }
      // same-number highlight everywhere (selection or numpad)
      if(highlightNum!==null && board[r][c]===highlightNum) cell.classList.add('same-number');

      if(fixed[r][c]) cell.classList.add('fixed');
      // persistent red for wrong cells until changed
      if(board[r][c]!==0 && !fixed[r][c] && board[r][c]!==solution[r][c]){
        cell.classList.add('error-persist');
      }

      // value or notes
      if(board[r][c]!==0){
        const v=document.createElement('div');
        v.className='value';
        v.textContent=board[r][c];
        cell.appendChild(v);
      } else if(notes[r][c].size>0){
        const ng=document.createElement('div');
        ng.className='notes';
        for(let n=1;n<=9;n++){
          const s=document.createElement('span');
          s.textContent=notes[r][c].has(n)?n:'';
          ng.appendChild(s);
        }
        cell.appendChild(ng);
      }

      cell.addEventListener('click',()=>selectCell(r,c));
      boardEl.appendChild(cell);
    }
  }
}
function selectCell(r,c){
  if(isPaused || gameOver) return;
  selected={r,c};
  // update highlight from cell value
  const v = board[r][c];
  if(v!==0){
    highlightedNumber = v;
  }
  renderBoard();
  updateNumpadState();
}
function updateMistakes(){
  mistakesEl.textContent=`${mistakes}/${maxMistakes}`;
  if(mistakes>=2) mistakesEl.classList.add('error');
  else mistakesEl.classList.remove('error');
}
function updateNotesButton(){
  if(isNotesMode){
    notesBtn.classList.add('active');
    notesIndicator.textContent='ON';
  } else {
    notesBtn.classList.remove('active');
    notesIndicator.textContent='OFF';
  }
}
function updateNumpadState(){
  const counts=Array(10).fill(0);
  for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(board[r][c]!==0) counts[board[r][c]]++;
  document.querySelectorAll('.numpad button').forEach(btn=>{
    const n=Number(btn.dataset.num);
    if(counts[n]>=9) btn.classList.add('used');
    else btn.classList.remove('used');
    if(highlightedNumber===n) btn.classList.add('active-num');
    else btn.classList.remove('active-num');
  });
}

// ---------- Game Actions ----------
function pushHistory(r,c){
  history.push({
    r,c,
    prevVal: board[r][c],
    prevNotes: new Set(notes[r][c]),
    mistakesBefore: mistakes
  });
  if(history.length>200) history.shift();
}

function placeNumber(num){
  if(!selected || gameOver || isPaused) return;
  const {r,c}=selected;
  if(fixed[r][c]) return;

  // if same number already placed and not notes mode, do nothing
  if(isNotesMode){
    // notes mode: toggle pencil mark, only if cell empty
    if(board[r][c]!==0) return; // can't note on filled cell
    pushHistory(r,c);
    if(notes[r][c].has(num)) notes[r][c].delete(num);
    else notes[r][c].add(num);
    renderBoard();
    return;
  }

  // normal mode
  if(board[r][c]===num) return; // no change
  pushHistory(r,c);
  // clear notes in this cell
  notes[r][c].clear();
  board[r][c]=num;

  // auto remove this note from peers (like sudoku.com)
  for(let i=0;i<9;i++){
    // row
    if(notes[r][i].has(num)) { /* we keep history only for current cell, peer note removal not undoable for simplicity */ notes[r][i].delete(num); }
    if(notes[i][c].has(num)) notes[i][c].delete(num);
  }
  const br=Math.floor(r/3)*3, bc=Math.floor(c/3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) notes[br+i][bc+j].delete(num);

  // highlight this number everywhere
  highlightedNumber = num;
  // check mistake
  if(num !== solution[r][c]){
    mistakes++;
    updateMistakes();
    triggerWrongFeedback();
    renderBoard();
    // keep red persistently via renderBoard error-persist; also flash
    const errCell = boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if(errCell){ errCell.classList.add('error-cell'); }
    if(mistakes>=maxMistakes){
      gameOver=true;
      clearInterval(timerInterval);
      setTimeout(()=>loseModal.classList.remove('hidden'),400);
    }
  } else {
    renderBoard();
    checkAndCelebrateLines();
  }
  updateNumpadState();
  checkWin();
}

function eraseCell(){
  if(!selected || gameOver || isPaused) return;
  const {r,c}=selected;
  if(fixed[r][c]) return;
  if(board[r][c]===0 && notes[r][c].size===0) return;
  pushHistory(r,c);
  board[r][c]=0;
  notes[r][c].clear();
  renderBoard();
  updateNumpadState();
  // after erase, allow re-celebration if line broken
  checkAndCelebrateLines();
}
function undo(){
  if(history.length===0 || gameOver) return;
  const last=history.pop();
  board[last.r][last.c]=last.prevVal;
  notes[last.r][last.c]=new Set(last.prevNotes);
  // mistakes are NOT undone (common Sudoku rule) – keep as is
  renderBoard();
  updateNumpadState();
  checkAndCelebrateLines();
}
let pendingHint = null;

function getHintExplanation(r,c){
  const ans = solution[r][c];
  const rowVals = new Set();
  const colVals = new Set();
  const boxVals = new Set();
  for(let i=0;i<9;i++){
    if(board[r][i]!==0) rowVals.add(board[r][i]);
    if(board[i][c]!==0) colVals.add(board[i][c]);
  }
  const br=Math.floor(r/3)*3, bc=Math.floor(c/3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++){
    const v=board[br+i][bc+j];
    if(v!==0) boxVals.add(v);
  }
  const allBlocked = new Set([...rowVals, ...colVals, ...boxVals]);
  const candidates = [];
  for(let n=1;n<=9;n++) if(!allBlocked.has(n)) candidates.push(n);
  // also find blocking cells for visual
  const rowBlocks = [];
  const colBlocks = [];
  const boxBlocks = [];
  for(let i=0;i<9;i++){
    if(board[r][i]!==0) rowBlocks.push({r, c:i, val:board[r][i]});
    if(board[i][c]!==0) colBlocks.push({r:i, c, val:board[i][c]});
  }
  for(let i=0;i<3;i++) for(let j=0;j<3;j++){
    const rr=br+i, cc=bc+j;
    if(board[rr][cc]!==0) boxBlocks.push({r:rr,c:cc,val:board[rr][cc]});
  }
  return {ans, rowVals:[...rowVals].sort((a,b)=>a-b), colVals:[...colVals].sort((a,b)=>a-b), boxVals:[...boxVals].sort((a,b)=>a-b), allBlocked, candidates, rowBlocks, colBlocks, boxBlocks, br, bc};
}

function renderHintVisual(r,c,info){
  const visual=document.getElementById('hintVisual');
  visual.innerHTML='';
  for(let rr=0;rr<9;rr++){
    for(let cc=0;cc<9;cc++){
      const div=document.createElement('div');
      div.className='hm-cell';
      const isTarget = rr===r && cc===c;
      const sameRow = rr===r;
      const sameCol = cc===c;
      const sameBox = Math.floor(rr/3)===Math.floor(info.br/3) && Math.floor(cc/3)===Math.floor(info.bc/3);
      if(isTarget) div.classList.add('hm-target');
      else if(sameRow && sameCol) div.classList.add('hm-overlap');
      else if(sameRow && sameBox) div.classList.add('hm-overlap');
      else if(sameCol && sameBox) div.classList.add('hm-overlap');
      else if(sameRow) div.classList.add('hm-row');
      else if(sameCol) div.classList.add('hm-col');
      else if(sameBox) div.classList.add('hm-box');
      if(board[rr][cc]!==0){
        div.textContent=board[rr][cc];
        div.classList.add('hm-fixed');
        // highlight cells that block candidates (contain numbers that are in allBlocked)
        if(!isTarget && info.allBlocked.has(board[rr][cc]) && (sameRow||sameCol||sameBox)){
          div.classList.add('hm-block');
        }
      } else if(isTarget){
        div.textContent='?';
      }
      // thick box borders via inline
      // add border hints via style (grid gap already)
      visual.appendChild(div);
    }
  }
}

function buildHintExplainHTML(r,c,info){
  const posLabel = `Row ${r+1}, Column ${c+1} (Box ${Math.floor(r/3)*3+Math.floor(c/3)+1})`;
  const rowList = info.rowVals.length? info.rowVals.join(', ') : 'none yet';
  const colList = info.colVals.length? info.colVals.join(', ') : 'none yet';
  const boxList = info.boxVals.length? info.boxVals.join(', ') : 'none yet';
  const blockedList = [...info.allBlocked].sort((a,b)=>a-b).join(', ') || 'none';
  let html='';
  html+=`<div class="ex-line">📍 <strong>${posLabel}</strong> is empty. The correct value is <strong>${info.ans}</strong>.</div>`;
  html+=`<div class="ex-line">• Row <strong>${r+1}</strong> already has: <strong>${rowList}</strong> → those numbers can't go here.</div>`;
  html+=`<div class="ex-line">• Column <strong>${c+1}</strong> already has: <strong>${colList}</strong> → blocked.</div>`;
  html+=`<div class="ex-line">• Its 3×3 box (rows ${info.br+1}-${info.br+3}, cols ${info.bc+1}-${info.bc+3}) already has: <strong>${boxList}</strong>.</div>`;
  if(info.candidates.length>1){
    html+=`<div class="ex-line">So remaining candidates after elimination are: <strong>${info.candidates.join(', ')}</strong>. Only <strong>${info.ans}</strong> keeps the puzzle solvable to the unique solution (checked by solver).</div>`;
  } else if(info.candidates.length===1){
    html+=`<div class="ex-line">✅ Only <strong>${info.ans}</strong> remains after elimination — every other digit 1-9 is already present in its row, column, or box.</div>`;
  } else {
    html+=`<div class="ex-line">All 1-9 appear blocked by current board, but the solution requires <strong>${info.ans}</strong> here (you may have a mistake elsewhere).</div>`;
  }
  html+=`<div class="ex-candidates">`;
  for(let n=1;n<=9;n++){
    const cls = n===info.ans ? 'cand answer' : info.allBlocked.has(n) ? 'cand blocked' : 'cand';
    const title = n===info.ans ? 'Answer' : info.allBlocked.has(n) ? 'Blocked' : 'Possible but invalid';
    html+=`<span class="${cls}" title="${title}">${n}</span>`;
  }
  html+=`</div>`;
  html+=`<div class="ex-line" style="margin-top:8px;color:var(--muted);font-size:12px;">Visual: yellow = target, blue = row/col, green = box, red outline = cells blocking other numbers. Tap “Fill Answer” to place <strong>${info.ans}</strong>.</div>`;
  return html;
}

function hint(){
  if(gameOver || isPaused) return;
  let target=null;
  if(selected && board[selected.r][selected.c]===0 && !fixed[selected.r][selected.c]){
    target=selected;
  } else {
    outer: for(let rr=0;rr<9;rr++) for(let cc=0;cc<9;cc++) if(board[rr][cc]===0 && !fixed[rr][cc]){ target={r:rr,c:cc}; break outer; }
  }
  if(!target) return;
  const {r,c}=target;
  const info=getHintExplanation(r,c);
  pendingHint={r,c, ans:info.ans};
  document.getElementById('hintTarget').textContent=`Cell R${r+1} × C${c+1} — Box ${Math.floor(r/3)*3+Math.floor(c/3)+1}`;
  document.getElementById('hintAnswer').textContent=info.ans;
  renderHintVisual(r,c,info);
  document.getElementById('hintExplain').innerHTML=buildHintExplainHTML(r,c,info);
  // highlight on main board temporarily
  selected={r,c};
  renderBoard();
  // add pulse
  setTimeout(()=>{
    const cell=boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if(cell) cell.classList.add('hint-highlight');
  },30);
  hintModal.classList.remove('hidden');
}

function applyHint(){
  if(!pendingHint) return;
  const {r,c,ans}=pendingHint;
  pushHistory(r,c);
  board[r][c]=ans;
  notes[r][c].clear();
  for(let i=0;i<9;i++){ notes[r][i].delete(ans); notes[i][c].delete(ans); }
  const br=Math.floor(r/3)*3, bc=Math.floor(c/3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) notes[br+i][bc+j].delete(ans);
  selected={r,c};
  pendingHint=null;
  hintModal.classList.add('hidden');
  renderBoard();
  checkAndCelebrateLines();
  updateNumpadState();
  checkWin();
}
function checkWin(){
  for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(board[r][c]!==solution[r][c]) return;
  gameOver=true;
  clearInterval(timerInterval);
  // best score handling
  const key=getDifficultyKey();
  const prevBest=loadBest(key);
  let isNewBest=false;
  if(prevBest==null || seconds < prevBest){
    saveBest(key, seconds);
    isNewBest=true;
  }
  updateBestDisplay();
  document.getElementById('winTime').textContent=`Time: ${timerEl.textContent}${isNewBest ? ' — 🏆 New Best!' : ''}`;
  document.getElementById('winMistakes').textContent=`Mistakes: ${mistakes}/${maxMistakes}`;
  winModal.classList.remove('hidden');
}
function hideAllModals(){
  winModal.classList.add('hidden');
  loseModal.classList.add('hidden');
  confirmModal.classList.add('hidden');
  hintModal.classList.add('hidden');
  pendingHint=null;
}
function requestNewGame(){
  // if board untouched, start directly
  const isPristine = JSON.stringify(board)===JSON.stringify(puzzle) && mistakes===0 && seconds<2;
  if(isPristine){
    initGame(difficultyEl.value);
  } else {
    confirmModal.classList.remove('hidden');
  }
}

// ---------- Event Listeners ----------
document.querySelectorAll('.numpad button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const num=Number(btn.dataset.num);
    // if no cell selected, just highlight everywhere
    if(!selected){
      highlightedNumber = highlightedNumber===num ? null : num;
      renderBoard();
      updateNumpadState();
      return;
    }
    // if in notes mode, keep note behavior, also set highlight
    highlightedNumber = num;
    placeNumber(num);
  });
});
notesBtn.addEventListener('click',()=>{ isNotesMode=!isNotesMode; updateNotesButton(); });
eraseBtn.addEventListener('click', eraseCell);
undoBtn.addEventListener('click', undo);
hintBtn.addEventListener('click', hint);
pauseBtn.addEventListener('click', togglePause);
newGameBtn.addEventListener('click', requestNewGame);
newGameTop.addEventListener('click', requestNewGame);
document.getElementById('confirmYes').addEventListener('click',()=>{
  hideAllModals();
  initGame(difficultyEl.value);
});
document.getElementById('confirmNo').addEventListener('click',()=> hideAllModals());
document.getElementById('winNewGame').addEventListener('click',()=>{
  hideAllModals();
  initGame(difficultyEl.value);
});
document.getElementById('loseNewGame').addEventListener('click',()=>{
  hideAllModals();
  initGame(difficultyEl.value);
});
difficultyEl.addEventListener('change',()=>{
  updateDifficultyPills();
  updateBestDisplay();
  requestNewGame();
  const revert = ()=>{
    if(!confirmModal.classList.contains('hidden')){
      const handler=()=>{
        if(confirmModal.classList.contains('hidden') && JSON.stringify(board)===JSON.stringify(puzzle)){
        } else if(confirmModal.classList.contains('hidden')){
        }
        document.getElementById('confirmNo').removeEventListener('click', handler);
      };
      document.getElementById('confirmNo').addEventListener('click', handler);
    }
  };
  setTimeout(revert,10);
});
// Difficulty pills
diffPills.forEach(btn=>{
  btn.addEventListener('click',()=>{
    const diff=btn.dataset.diff;
    if(difficultyEl.value===diff) return;
    difficultyEl.value=diff;
    updateDifficultyPills();
    updateBestDisplay();
    requestNewGame();
    const revert2=()=>{
      if(!confirmModal.classList.contains('hidden')){
        const handler2=()=>{
          if(confirmModal.classList.contains('hidden') && JSON.stringify(board)===JSON.stringify(puzzle)){
          } else if(confirmModal.classList.contains('hidden')){
            // canceled: revert pills UI
            updateDifficultyPills();
            updateBestDisplay();
          }
          document.getElementById('confirmNo').removeEventListener('click', handler2);
        };
        document.getElementById('confirmNo').addEventListener('click', handler2);
      }
    };
    setTimeout(revert2,10);
  });
});
if(blocksRange){
  blocksRange.addEventListener('input',()=>{
    if(blocksVal) blocksVal.textContent=blocksRange.value;
    // update key display for custom
    if(difficultyEl.value==='custom') updateBestDisplay();
  });
  blocksRange.addEventListener('change',()=>{
    if(difficultyEl.value==='custom'){
      updateBestDisplay();
      // if already on custom and pristine, regenerate immediately
      const isPristine = JSON.stringify(board)===JSON.stringify(puzzle) && mistakes===0 && seconds<2;
      if(isPristine){
        initGame('custom');
      }
    }
  });
}

// Keyboard support
document.addEventListener('keydown',(e)=>{
  if(e.key>='1' && e.key<='9') placeNumber(Number(e.key));
  else if(e.key==='Backspace' || e.key==='Delete' || e.key==='0') eraseCell();
  else if(e.key==='n' || e.key==='N'){ isNotesMode=!isNotesMode; updateNotesButton(); }
  else if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); }
  else if(e.key==='ArrowUp' && selected){ e.preventDefault(); selectCell(Math.max(0,selected.r-1), selected.c); }
  else if(e.key==='ArrowDown' && selected){ e.preventDefault(); selectCell(Math.min(8,selected.r+1), selected.c); }
  else if(e.key==='ArrowLeft' && selected){ e.preventDefault(); selectCell(selected.r, Math.max(0,selected.c-1)); }
  else if(e.key==='ArrowRight' && selected){ e.preventDefault(); selectCell(selected.r, Math.min(8,selected.c+1)); }
});

// Hint modal buttons
document.getElementById('hintFillBtn').addEventListener('click', applyHint);
document.getElementById('hintCloseBtn').addEventListener('click', ()=>{ hintModal.classList.add('hidden'); pendingHint=null; });
document.getElementById('hintCloseX').addEventListener('click', ()=>{ hintModal.classList.add('hidden'); pendingHint=null; });

// Close modal on backdrop click
[winModal,loseModal,confirmModal,hintModal].forEach(m=>{
  m.addEventListener('click',(e)=>{ if(e.target===m){ m.classList.add('hidden'); if(m===hintModal) pendingHint=null; }});
});

// Init
initGame(difficultyEl.value);
