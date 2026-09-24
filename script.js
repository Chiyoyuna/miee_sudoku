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
const sizePills = document.querySelectorAll('.size-pill');

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
let BOARD_N = 9;
let BOX_H = 3;
let BOX_W = 3;
let customSize = 9; // for Custom mode 4/6/9

const DIFFICULTY_CLUES = {
  easy: 40,     // cells to remove
  medium: 50,
  hard: 58,
  expert: 64
};
const DIFFICULTY_CLUES_MAP = {
  9: { easy: 40, medium: 50, hard: 58, expert: 64, custom: 50 },
  6: { easy: 12, medium: 18, hard: 22, expert: 26, custom: 18 },
  4: { easy: 4,  medium: 6,  hard: 8,  expert: 10, custom: 6 }
};

function getBoxDims(n){
  if(n===4) return [2,2];
  if(n===6) return [2,3];
  return [3,3];
}
function setBoardSize(n){
  BOARD_N = n;
  [BOX_H, BOX_W] = getBoxDims(n);
  boardEl.style.gridTemplateColumns = `repeat(${n},1fr)`;
  boardEl.style.gridTemplateRows = `repeat(${n},1fr)`;
  // numpad: show 1..n, hide rest
  document.querySelectorAll('.numpad button').forEach(btn=>{
    const v=Number(btn.dataset.num);
    btn.style.display = v<=n ? '' : 'none';
  });
  // also update numpad grid columns dynamically
  const np=document.getElementById('numpad');
  if(np) np.style.gridTemplateColumns=`repeat(${n},1fr)`;
}

// ---------- Sudoku Generator ----------
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function createEmptyBoard(n = BOARD_N){
  return Array.from({length:n},()=>Array(n).fill(0));
}
function isValid(board,r,c,val){
  for(let i=0;i<BOARD_N;i++){
    if(board[r][i]===val) return false;
    if(board[i][c]===val) return false;
  }
  const br=Math.floor(r/BOX_H)*BOX_H, bc=Math.floor(c/BOX_W)*BOX_W;
  for(let i=0;i<BOX_H;i++) for(let j=0;j<BOX_W;j++) if(board[br+i][bc+j]===val) return false;
  return true;
}
function solveBoard(board){
  for(let r=0;r<BOARD_N;r++){
    for(let c=0;c<BOARD_N;c++){
      if(board[r][c]===0){
        const nums=shuffle(Array.from({length:BOARD_N},(_,i)=>i+1));
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
  // decide board size
  let size = BOARD_N;
  if(difficulty==='custom'){
    size = customSize;
    setBoardSize(size);
  } else {
    size = 9;
    setBoardSize(size);
  }
  const sol=generateSolved();
  const puz=sol.map(row=>[...row]);
  const map = DIFFICULTY_CLUES_MAP[size] || DIFFICULTY_CLUES_MAP[9];
  let cellsToRemove = map[difficulty];
  if(difficulty==='custom') cellsToRemove = map.custom;
  if(cellsToRemove==null) cellsToRemove = Math.floor(size*size*0.55);
  const maxRemove = size*size - size;
  cellsToRemove = Math.max(0, Math.min(maxRemove, cellsToRemove));
  let removed=0;
  const positions=[];
  for(let r=0;r<size;r++) for(let c=0;c<size;c++) positions.push([r,c]);
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
  if(d==='custom') return `custom_${customSize}`;
  return `${BOARD_N}_${d}`;
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
  sizePills.forEach(p=> p.classList.toggle('active', Number(p.dataset.size)===customSize));
}

// ---------- Validation helpers — rule-based, not solution-based ----------
function hasConflict(bd, r, c){
  const val = bd[r][c];
  if(val===0) return false;
  for(let i=0;i<BOARD_N;i++){
    if(i!==c && bd[r][i]===val) return true;
    if(i!==r && bd[i][c]===val) return true;
  }
  const br=Math.floor(r/BOX_H)*BOX_H, bc=Math.floor(c/BOX_W)*BOX_W;
  for(let i=0;i<BOX_H;i++) for(let j=0;j<BOX_W;j++){
    const rr=br+i, cc=bc+j;
    if((rr!==r || cc!==c) && bd[rr][cc]===val) return true;
  }
  return false;
}
function isRowFilledValid(r){
  const seen=new Set();
  for(let c=0;c<BOARD_N;c++){
    const v=board[r][c];
    if(v===0) return false;
    if(v<1 || v>BOARD_N) return false;
    if(seen.has(v)) return false;
    seen.add(v);
  }
  return seen.size===BOARD_N;
}
function isColFilledValid(c){
  const seen=new Set();
  for(let r=0;r<BOARD_N;r++){
    const v=board[r][c];
    if(v===0) return false;
    if(seen.has(v)) return false;
    seen.add(v);
  }
  return seen.size===BOARD_N;
}
function isBoxFilledValid(boxIdx){
  const cols = BOARD_N / BOX_W;
  const br=Math.floor(boxIdx / cols)*BOX_H, bc=(boxIdx % cols)*BOX_W;
  const seen=new Set();
  for(let i=0;i<BOX_H;i++) for(let j=0;j<BOX_W;j++){
    const v=board[br+i][bc+j];
    if(v===0) return false;
    if(seen.has(v)) return false;
    seen.add(v);
  }
  return seen.size===BOARD_N;
}
function isBoardFullyValid(){
  // every cell filled and no conflicts
  for(let r=0;r<BOARD_N;r++) for(let c=0;c<BOARD_N;c++){
    if(board[r][c]===0) return false;
    if(hasConflict(board,r,c)) return false;
  }
  // also verify each row/col/box contains 1..N exactly once (covered by above but double-check counts)
  for(let r=0;r<BOARD_N;r++) if(!isRowFilledValid(r)) return false;
  for(let c=0;c<BOARD_N;c++) if(!isColFilledValid(c)) return false;
  for(let b=0;b<BOARD_N;b++) if(!isBoxFilledValid(b)) return false;
  return true;
}
// legacy names kept for celebrate logic — now rule-based
function isRowComplete(r){ return isRowFilledValid(r); }
function isColComplete(c){ return isColFilledValid(c); }
function isBoxComplete(boxIdx){ return isBoxFilledValid(boxIdx); }
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
  for(let c=0;c<BOARD_N;c++) cells.push(boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`));
  celebrateCells(cells);
}
function celebrateCol(c){
  const cells=[];
  for(let r=0;r<BOARD_N;r++) cells.push(boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`));
  celebrateCells(cells);
}
function celebrateBox(boxIdx){
  const cols = BOARD_N / BOX_W;
  const br=Math.floor(boxIdx / cols)*BOX_H, bc=(boxIdx % cols)*BOX_W;
  const cells=[];
  for(let i=0;i<BOX_H;i++) for(let j=0;j<BOX_W;j++) cells.push(boardEl.querySelector(`[data-r="${br+i}"][data-c="${bc+j}"]`));
  celebrateCells(cells);
}
function checkAndCelebrateLines(){
  if(gameOver || isPaused) return;
  // rows
  for(let r=0;r<BOARD_N;r++){
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
  for(let c=0;c<BOARD_N;c++){
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
  const numBoxes = BOARD_N;
  for(let b=0;b<numBoxes;b++){
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
  // set size first so generatePuzzle uses correct BOARD_N
  if(difficulty==='custom'){
    setBoardSize(customSize);
  } else {
    setBoardSize(9);
  }
  const {sol,puz}=generatePuzzle(difficulty);
  solution=sol;
  puzzle=puz;
  board=puz.map(r=>[...r]);
  fixed=puz.map(r=>r.map(v=>v!==0));
  notes=Array.from({length:BOARD_N},()=>Array.from({length:BOARD_N},()=>new Set()));
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
  boardEl.style.gridTemplateColumns = `repeat(${BOARD_N},1fr)`;
  boardEl.style.gridTemplateRows = `repeat(${BOARD_N},1fr)`;
  let highlightNum = highlightedNumber;
  if(selected){
    const sv = board[selected.r][selected.c];
    if(sv!==0) highlightNum = sv;
  }
  for(let r=0;r<BOARD_N;r++){
    for(let c=0;c<BOARD_N;c++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.r=r;
      cell.dataset.c=c;
      // dynamic thick borders for boxes
      if((c+1)%BOX_W===0 && c!==BOARD_N-1) cell.style.borderRight='2px solid var(--border-strong)';
      if((r+1)%BOX_H===0 && r!==BOARD_N-1) cell.style.borderBottom='2px solid var(--border-strong)';

      if(selected && selected.r===r && selected.c===c) cell.classList.add('selected');
      else if(selected){
        const sr=selected.r, sc=selected.c;
        const sameRow = r===sr;
        const sameCol = c===sc;
        const sameBox = Math.floor(r/BOX_H)===Math.floor(sr/BOX_H) && Math.floor(c/BOX_W)===Math.floor(sc/BOX_W);
        if(sameRow || sameCol || sameBox) cell.classList.add('highlight');
      }
      if(highlightNum!==null && board[r][c]===highlightNum) cell.classList.add('same-number');

      if(fixed[r][c]) cell.classList.add('fixed');
      if(board[r][c]!==0 && !fixed[r][c] && hasConflict(board,r,c)){
        cell.classList.add('error-persist');
      }

      if(board[r][c]!==0){
        const v=document.createElement('div');
        v.className='value';
        v.textContent=board[r][c];
        cell.appendChild(v);
      } else if(notes[r][c].size>0){
        const ng=document.createElement('div');
        ng.className='notes';
        // notes grid adapts to BOARD_N
        ng.style.gridTemplateColumns=`repeat(${Math.ceil(Math.sqrt(BOARD_N))},1fr)`;
        for(let n=1;n<=BOARD_N;n++){
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
  const counts=Array(BOARD_N+1).fill(0);
  for(let r=0;r<BOARD_N;r++) for(let c=0;c<BOARD_N;c++) if(board[r][c]!==0) counts[board[r][c]]++;
  document.querySelectorAll('.numpad button').forEach(btn=>{
    const n=Number(btn.dataset.num);
    if(n>BOARD_N){ btn.style.display='none'; return; }
    btn.style.display='';
    if(counts[n]>=BOARD_N) btn.classList.add('used');
    else btn.classList.remove('used');
    if(highlightedNumber===n) btn.classList.add('active-num');
    else btn.classList.remove('active-num');
  });
  const np=document.getElementById('numpad');
  if(np) np.style.gridTemplateColumns=`repeat(${BOARD_N},1fr)`;
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

  // auto remove this note from peers
  for(let i=0;i<BOARD_N;i++){
    if(notes[r][i].has(num)) notes[r][i].delete(num);
    if(notes[i][c].has(num)) notes[i][c].delete(num);
  }
  const br=Math.floor(r/BOX_H)*BOX_H, bc=Math.floor(c/BOX_W)*BOX_W;
  for(let i=0;i<BOX_H;i++) for(let j=0;j<BOX_W;j++) notes[br+i][bc+j].delete(num);

  // highlight this number everywhere
  highlightedNumber = num;
  // check mistake — rule-based: only if violates Sudoku rules (duplicate in row/col/box)
  const isMistake = hasConflict(board,r,c);
  if(isMistake){
    // don't count beyond maxMistakes to allow "continue" without infinite popups
    if(mistakes < maxMistakes){
      mistakes++;
      updateMistakes();
    }
    triggerWrongFeedback();
    renderBoard();
    // keep red persistently via renderBoard error-persist; also flash
    const errCell = boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if(errCell){ errCell.classList.add('error-cell'); }
    if(mistakes>=maxMistakes){
      // pause but give choice: Continue vs New Game
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

// Dynamic hint solver — finds a valid value for (r,c) by solving current board
function getHintAnsForCell(r,c){
  // Try to solve a copy of the current board deterministically
  function solveDeterministic(bd){
    for(let rr=0;rr<BOARD_N;rr++) for(let cc=0;cc<BOARD_N;cc++) if(bd[rr][cc]===0){
      for(let n=1;n<=BOARD_N;n++){
        if(isValid(bd,rr,cc,n)){
          bd[rr][cc]=n;
          if(solveDeterministic(bd)) return true;
          bd[rr][cc]=0;
        }
      }
      return false;
    }
    return true;
  }
  const copy = board.map(row=>[...row]);
  const tryCopy = copy.map(row=>[...row]);
  if(solveDeterministic(tryCopy)) return tryCopy[r][c];
  // If board has conflicts (wrong entries), clean them and retry
  const cleaned = board.map(row=>[...row]);
  for(let rr=0;rr<BOARD_N;rr++) for(let cc=0;cc<BOARD_N;cc++){
    if(cleaned[rr][cc]!==0 && hasConflict(cleaned,rr,cc) && !fixed[rr][cc]) cleaned[rr][cc]=0;
  }
  const tryCleaned = cleaned.map(row=>[...row]);
  if(solveDeterministic(tryCleaned)) return tryCleaned[r][c];
  // fallback to stored solution
  return solution[r][c];
}

function getHintExplanation(r,c){
  const ans = getHintAnsForCell(r,c);
  const rowVals = new Set();
  const colVals = new Set();
  const boxVals = new Set();
  for(let i=0;i<BOARD_N;i++){
    if(board[r][i]!==0) rowVals.add(board[r][i]);
    if(board[i][c]!==0) colVals.add(board[i][c]);
  }
  const br=Math.floor(r/BOX_H)*BOX_H, bc=Math.floor(c/BOX_W)*BOX_W;
  for(let i=0;i<BOX_H;i++) for(let j=0;j<BOX_W;j++){
    const v=board[br+i][bc+j];
    if(v!==0) boxVals.add(v);
  }
  const allBlocked = new Set([...rowVals, ...colVals, ...boxVals]);
  const candidates = [];
  for(let n=1;n<=BOARD_N;n++) if(!allBlocked.has(n)) candidates.push(n);
  const rowBlocks = [];
  const colBlocks = [];
  const boxBlocks = [];
  for(let i=0;i<BOARD_N;i++){
    if(board[r][i]!==0) rowBlocks.push({r, c:i, val:board[r][i]});
    if(board[i][c]!==0) colBlocks.push({r:i, c, val:board[i][c]});
  }
  for(let i=0;i<BOX_H;i++) for(let j=0;j<BOX_W;j++){
    const rr=br+i, cc=bc+j;
    if(board[rr][cc]!==0) boxBlocks.push({r:rr,c:cc,val:board[rr][cc]});
  }
  return {ans, rowVals:[...rowVals].sort((a,b)=>a-b), colVals:[...colVals].sort((a,b)=>a-b), boxVals:[...boxVals].sort((a,b)=>a-b), allBlocked, candidates, rowBlocks, colBlocks, boxBlocks, br, bc};
}

function renderHintVisual(r,c,info){
  const visual=document.getElementById('hintVisual');
  visual.innerHTML='';
  visual.style.gridTemplateColumns=`repeat(${BOARD_N},1fr)`;
  for(let rr=0;rr<BOARD_N;rr++){
    for(let cc=0;cc<BOARD_N;cc++){
      const div=document.createElement('div');
      div.className='hm-cell';
      const isTarget = rr===r && cc===c;
      const sameRow = rr===r;
      const sameCol = cc===c;
      const sameBox = Math.floor(rr/BOX_H)===Math.floor(info.br/BOX_H) && Math.floor(cc/BOX_W)===Math.floor(info.bc/BOX_W);
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
        if(!isTarget && info.allBlocked.has(board[rr][cc]) && (sameRow||sameCol||sameBox)){
          div.classList.add('hm-block');
        }
      } else if(isTarget){
        div.textContent='?';
      }
      visual.appendChild(div);
    }
  }
}

function buildHintExplainHTML(r,c,info){
  const cols = BOARD_N / BOX_W;
  const boxId = Math.floor(r/BOX_H)*cols+Math.floor(c/BOX_W)+1;
  const posLabel = `Row ${r+1}, Column ${c+1} (Box ${boxId}, ${BOX_H}×${BOX_W})`;
  const rowList = info.rowVals.length? info.rowVals.join(', ') : 'none yet';
  const colList = info.colVals.length? info.colVals.join(', ') : 'none yet';
  const boxList = info.boxVals.length? info.boxVals.join(', ') : 'none yet';
  let html='';
  html+=`<div class="ex-line">📍 <strong>${posLabel}</strong> is empty. The correct value is <strong>${info.ans}</strong>.</div>`;
  html+=`<div class="ex-line">• Row <strong>${r+1}</strong> already has: <strong>${rowList}</strong> → those numbers can't go here.</div>`;
  html+=`<div class="ex-line">• Column <strong>${c+1}</strong> already has: <strong>${colList}</strong> → blocked.</div>`;
  html+=`<div class="ex-line">• Its ${BOX_H}×${BOX_W} box (rows ${info.br+1}-${info.br+BOX_H}, cols ${info.bc+1}-${info.bc+BOX_W}) already has: <strong>${boxList}</strong>.</div>`;
  if(info.candidates.length>1){
    html+=`<div class="ex-line">So remaining candidates after elimination are: <strong>${info.candidates.join(', ')}</strong>. Only <strong>${info.ans}</strong> keeps the puzzle solvable.</div>`;
  } else if(info.candidates.length===1){
    html+=`<div class="ex-line">✅ Only <strong>${info.ans}</strong> remains after elimination — every other digit 1-${BOARD_N} is already present.</div>`;
  } else {
    html+=`<div class="ex-line">All 1-${BOARD_N} appear blocked, but the solution requires <strong>${info.ans}</strong> here (you may have a mistake elsewhere).</div>`;
  }
  html+=`<div class="ex-candidates">`;
  for(let n=1;n<=BOARD_N;n++){
    const cls = n===info.ans ? 'cand answer' : info.allBlocked.has(n) ? 'cand blocked' : 'cand';
    const title = n===info.ans ? 'Answer' : info.allBlocked.has(n) ? 'Blocked' : 'Possible but invalid';
    html+=`<span class="${cls}" title="${title}">${n}</span>`;
  }
  html+=`</div>`;
  html+=`<div class="ex-line" style="margin-top:8px;color:var(--muted);font-size:12px;">Visual: yellow = target, blue = row/col, green = box, red outline = blocking numbers. Tap “Fill Answer” to place <strong>${info.ans}</strong>.</div>`;
  return html;
}

function hint(){
  if(gameOver || isPaused) return;
  let target=null;
  if(selected && board[selected.r][selected.c]===0 && !fixed[selected.r][selected.c]){
    target=selected;
  } else {
    outer: for(let rr=0;rr<BOARD_N;rr++) for(let cc=0;cc<BOARD_N;cc++) if(board[rr][cc]===0 && !fixed[rr][cc]){ target={r:rr,c:cc}; break outer; }
  }
  if(!target) return;
  const {r,c}=target;
  const info=getHintExplanation(r,c);
  pendingHint={r,c, ans:info.ans};
  const cols = BOARD_N / BOX_W;
  const boxId = Math.floor(r/BOX_H)*cols+Math.floor(c/BOX_W)+1;
  document.getElementById('hintTarget').textContent=`Cell R${r+1} × C${c+1} — Box ${boxId} (${BOARD_N}×${BOARD_N})`;
  document.getElementById('hintAnswer').textContent=info.ans;
  renderHintVisual(r,c,info);
  document.getElementById('hintExplain').innerHTML=buildHintExplainHTML(r,c,info);
  selected={r,c};
  renderBoard();
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
  for(let i=0;i<BOARD_N;i++){ notes[r][i].delete(ans); notes[i][c].delete(ans); }
  const br=Math.floor(r/BOX_H)*BOX_H, bc=Math.floor(c/BOX_W)*BOX_W;
  for(let i=0;i<BOX_H;i++) for(let j=0;j<BOX_W;j++) notes[br+i][bc+j].delete(ans);
  selected={r,c};
  pendingHint=null;
  hintModal.classList.add('hidden');
  renderBoard();
  checkAndCelebrateLines();
  updateNumpadState();
  checkWin();
}
function celebrateWholeBoard(){
  // make ALL cells do little jump with staggered wave
  const cells = boardEl.querySelectorAll('.cell');
  boardEl.classList.add('win-celebrating');
  cells.forEach((cell, idx)=>{
    const r = Math.floor(idx / BOARD_N);
    const c = idx % BOARD_N;
    // wave from top-left to bottom-right
    const delay = (r * 0.04 + c * 0.03);
    cell.style.animationDelay = `${delay}s`;
    // sparkle for every cell
    // clear previous sparkles
    cell.querySelectorAll('.sparkle').forEach(s=>s.remove());
    // add celebrate class handled by board.win-celebrating, but also force sparkles
    setTimeout(()=> spawnSparkles(cell), delay*1000);
  });
  // remove class after animation so board returns to normal
  setTimeout(()=>{
    boardEl.classList.remove('win-celebrating');
    cells.forEach(c=>{
      c.style.animationDelay='';
      c.querySelectorAll('.sparkle').forEach(s=> setTimeout(()=>s.remove(), 600));
    });
  }, 1400);
  if(navigator.vibrate) navigator.vibrate([40,30,60,30,80]);
}
function spawnConfetti(){
  const container = document.getElementById('winConfetti');
  if(!container) return;
  container.innerHTML='';
  const colors = ['#ff7aa2','#ffb700','#4dc9a0','#7ab8ff','#ff6b6b','#ffd700','#a78bfa','#ff9f43'];
  const count = 32;
  for(let i=0;i<count;i++){
    const p = document.createElement('div');
    p.className='confetti-piece';
    p.style.left = Math.random()*100 + '%';
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.animationDuration = (0.9 + Math.random()*0.7) + 's';
    p.style.animationDelay = (Math.random()*0.25) + 's';
    p.style.transform = `rotate(${Math.random()*360}deg)`;
    // random shape: some round
    if(Math.random()>0.6) p.style.borderRadius='50%';
    p.style.width = (6 + Math.random()*6) + 'px';
    p.style.height = (8 + Math.random()*8) + 'px';
    container.appendChild(p);
  }
}
function restartLoopyJump(){
  const loopy = document.getElementById('loopyChar');
  if(!loopy) return;
  loopy.style.animation='none';
  void loopy.offsetWidth;
  loopy.style.animation='';
  // ensure jumping, not idle
  loopy.classList.remove('idle');
}
function checkWin(){
  if(!isBoardFullyValid()) return;
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
  // full board celebration: little jump for ALL boxes
  celebrateWholeBoard();
  // after a short stagger, show Loopy modal
  setTimeout(()=>{
    document.getElementById('winTime').textContent = formatTime(seconds);
    document.getElementById('winMistakes').textContent = `${mistakes}/${maxMistakes}`;
    const bestToShow = loadBest(key);
    const bestEl = document.getElementById('winBest');
    if(bestEl) bestEl.textContent = bestToShow!=null ? formatTime(bestToShow) : '—';
    if(bestEl) bestEl.classList.toggle('is-new', isNewBest);
    const badge = document.getElementById('winNewBestBadge');
    if(badge) badge.classList.toggle('hidden', !isNewBest);
    spawnConfetti();
    restartLoopyJump();
    winModal.classList.remove('hidden');
    // Loopy continues jumping for 3.5s then settles to idle bob
    setTimeout(()=>{
      const loopy=document.getElementById('loopyChar');
      if(loopy) loopy.classList.add('idle');
    }, 3500);
  }, 420);
}
function hideAllModals(){
  winModal.classList.add('hidden');
  loseModal.classList.add('hidden');
  confirmModal.classList.add('hidden');
  hintModal.classList.add('hidden');
  pendingHint=null;
  // clean confetti & reset Loopy for next win
  const conf=document.getElementById('winConfetti');
  if(conf) setTimeout(()=>{ if(winModal.classList.contains('hidden')) conf.innerHTML=''; }, 300);
  const loopy=document.getElementById('loopyChar');
  if(loopy) loopy.classList.remove('idle');
  boardEl.classList.remove('win-celebrating');
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
document.getElementById('loseContinueBtn').addEventListener('click',()=>{
  // Continue the current game despite 3 mistakes
  loseModal.classList.add('hidden');
  gameOver=false;
  isPaused=false;
  boardEl.style.opacity='1';
  boardEl.style.pointerEvents='auto';
  pauseBtn.textContent='⏸';
  startTimer();
  renderBoard();
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
function smoothBoardSwitch(nextFn){
  boardEl.style.transition='opacity 0.22s ease, transform 0.22s ease';
  boardEl.style.opacity='0';
  boardEl.style.transform='scale(0.98)';
  setTimeout(()=>{
    nextFn();
    requestAnimationFrame(()=>{
      boardEl.style.opacity='1';
      boardEl.style.transform='scale(1)';
    });
    setTimeout(()=>{ boardEl.style.transition=''; boardEl.style.transform=''; }, 300);
  }, 180);
}
sizePills.forEach(btn=>{
  btn.addEventListener('click',()=>{
    const sz=Number(btn.dataset.size);
    // ensure Custom is selected visually
    if(difficultyEl.value!=='custom'){
      difficultyEl.value='custom';
    }
    const sameSize = customSize===sz;
    customSize=sz;
    updateDifficultyPills();
    updateBestDisplay();
    hideAllModals();
    // smooth auto-change instantly, no New Game click needed
    if(sameSize && BOARD_N===sz) return;
    smoothBoardSwitch(()=> initGame('custom'));
  });
});

// Keyboard support
document.addEventListener('keydown',(e)=>{
  if(e.key>='1' && e.key<=String(BOARD_N)) placeNumber(Number(e.key));
  else if(e.key==='Backspace' || e.key==='Delete' || e.key==='0') eraseCell();
  else if(e.key==='n' || e.key==='N'){ isNotesMode=!isNotesMode; updateNotesButton(); }
  else if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); }
  else if(e.key==='ArrowUp' && selected){ e.preventDefault(); selectCell(Math.max(0,selected.r-1), selected.c); }
  else if(e.key==='ArrowDown' && selected){ e.preventDefault(); selectCell(Math.min(BOARD_N-1,selected.r+1), selected.c); }
  else if(e.key==='ArrowLeft' && selected){ e.preventDefault(); selectCell(selected.r, Math.max(0,selected.c-1)); }
  else if(e.key==='ArrowRight' && selected){ e.preventDefault(); selectCell(selected.r, Math.min(BOARD_N-1,selected.c+1)); }
});

// Hint modal buttons
document.getElementById('hintFillBtn').addEventListener('click', applyHint);
document.getElementById('hintCloseBtn').addEventListener('click', ()=>{ hintModal.classList.add('hidden'); pendingHint=null; });
document.getElementById('hintCloseX').addEventListener('click', ()=>{ hintModal.classList.add('hidden'); pendingHint=null; });

// Close modal on backdrop click
[winModal,confirmModal,hintModal].forEach(m=>{
  m.addEventListener('click',(e)=>{ if(e.target===m){ m.classList.add('hidden'); if(m===hintModal) pendingHint=null; }});
});
loseModal.addEventListener('click',(e)=>{
  if(e.target===loseModal){
    // backdrop on lose = Continue Game (don't trap player)
    loseModal.classList.add('hidden');
    gameOver=false;
    isPaused=false;
    boardEl.style.opacity='1';
    boardEl.style.pointerEvents='auto';
    pauseBtn.textContent='⏸';
    startTimer();
    renderBoard();
  }
});

// Init
initGame(difficultyEl.value);
