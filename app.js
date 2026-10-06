(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const FORCE_SCALE = 0.82;
  const VERTICAL_SCALE = 0.82;
  const CENTER = { x: 400, y: 300 };
  const DEFAULT_FORCES = { applied: 60, friction: -60, normal: 80, weight: 80 };
  const FORCE_META = {
    applied: { color: '#832058', marker: 'arrowApplied', label: 'כוח מופעל', axis: 'x', min: -120, max: 120 },
    friction: { color: '#d68532', marker: 'arrowFriction', label: 'חיכוך', axis: 'x', min: -120, max: 120 },
    normal: { color: '#6db580', marker: 'arrowNormal', label: 'נורמלי', axis: 'up', min: 0, max: 120 },
    weight: { color: '#17365e', marker: 'arrowWeight', label: 'כובד', axis: 'down', min: 0, max: 120 }
  };

  const missions = [
    {
      title: 'יוצרים שיווי משקל',
      text: 'אזנו את הכוחות האופקיים והאנכיים כך שהגוף יישאר במנוחה.',
      target: 'ΣF = 0 N',
      start: { applied: 60, friction: -20, normal: 80, weight: 80 },
      check: (_f, net) => net.x === 0 && net.y === 0,
      hint: (net) => net.x !== 0 ? 'בדקו את שני הכוחות האופקיים: כדי לאזן, הגדלים צריכים להיות שווים והכיוונים מנוגדים.' : 'האופקי מאוזן. עכשיו השוו בין הכוח הנורמלי לכוח הכובד.'
    },
    {
      title: 'מתקדמים ימינה',
      text: 'צרו שקול אופקי של 40 ניוטון ימינה, בלי כוח אנכי נטו.',
      target: 'ΣFₓ = +40 N · ΣFᵧ = 0 N',
      start: { applied: 50, friction: -40, normal: 70, weight: 90 },
      check: (_f, net) => net.x === 40 && net.y === 0,
      hint: (net) => net.y !== 0 ? 'קודם אזנו את הכוחות האנכיים: הנורמלי והכובד צריכים להיות שווים.' : `כרגע השקול האופקי הוא ${signed(net.x)} N. כוונו אותו ל־+40 N.`
    },
    {
      title: 'משנים כיוון',
      text: 'גרמו לגוף לנוע שמאלה בעזרת שקול אופקי של 30 ניוטון.',
      target: 'ΣFₓ = −30 N · ΣFᵧ = 0 N',
      start: { applied: 40, friction: -20, normal: 60, weight: 60 },
      check: (_f, net) => net.x === -30 && net.y === 0,
      hint: (net) => net.y !== 0 ? 'השאירו את הכוחות האנכיים מאוזנים.' : `כדי לנוע שמאלה, סכום הכוחות האופקיים חייב להיות שלילי. כרגע הוא ${signed(net.x)} N.`
    },
    {
      title: 'ארבעה כוחות פעילים',
      text: 'בנו מצב מאוזן עם 70 ניוטון לכל צד ו־100 ניוטון למעלה ולמטה.',
      target: '70 ↔ 70 · 100 ↕ 100',
      start: { applied: 20, friction: -70, normal: 60, weight: 100 },
      check: (f) => f.applied === 70 && f.friction === -70 && f.normal === 100 && f.weight === 100,
      hint: () => 'במשימה הזו לא מספיק שהשקול אפס: התאימו גם את גודלו של כל אחד מארבעת הכוחות לערכי היעד.'
    },
    {
      title: 'אתגר הסיום',
      text: 'כוונו כוח מופעל של 100 ניוטון, חיכוך של 80 ניוטון שמאלה, ואיזון אנכי של 60 ניוטון.',
      target: 'ΣFₓ = +20 N · ΣFᵧ = 0 N',
      start: { applied: -40, friction: 30, normal: 90, weight: 40 },
      check: (f) => f.applied === 100 && f.friction === -80 && f.normal === 60 && f.weight === 60,
      hint: () => 'בדקו כל כוח מול הדרישה. אם תרצו, פתחו את השקול כרמז מלוח הכוחות.',
      challenge: true
    }
  ];

  let forces = { ...DEFAULT_FORCES };
  let mode = 'explore';
  let missionIndex = 0;
  let missionAttempts = 0;
  let totalAttempts = 0;
  let score = 0;
  let solved = false;
  let muted = false;
  let toastTimer = null;
  let dragging = null;
  let challengeAidRevealed = false;

  const elements = {
    screens: [...document.querySelectorAll('.screen')],
    vectors: $('vectors'),
    netVector: $('netVector'),
    movingBody: $('movingBody'),
    resultant: $('resultantReadout'),
    motionBanner: $('motionBanner'),
    feedback: $('missionFeedback'),
    missionCard: $('missionCard'),
    missionProgress: $('missionProgress'),
    scoreChip: $('scoreChip')
  };

  function signed(value) {
    if (value > 0) return `+${value}`;
    if (value < 0) return `−${Math.abs(value)}`;
    return '0';
  }

  function displayForce(key, value) {
    return key === 'normal' || key === 'weight' ? String(value) : signed(value);
  }

  function forceResult() {
    return { x: forces.applied + forces.friction, y: forces.normal - forces.weight };
  }

  function magnitude(net) {
    return Math.round(Math.hypot(net.x, net.y));
  }

  function directionText(net) {
    if (net.x === 0 && net.y === 0) return { title: 'שיווי משקל', detail: 'השקול הוא אפס' };
    const horizontal = net.x > 0 ? 'ימינה' : net.x < 0 ? 'שמאלה' : '';
    const vertical = net.y > 0 ? 'ולמעלה' : net.y < 0 ? 'ולמטה' : '';
    const direction = [horizontal, vertical].filter(Boolean).join(' ');
    return { title: `תנועה ${direction}`, detail: `השקול פועל ${direction}` };
  }

  function setScreen(id) {
    elements.screens.forEach((screen) => screen.classList.toggle('is-active', screen.id === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setMode(nextMode) {
    mode = nextMode;
    solved = false;
    $('modeLabel').textContent = mode === 'missions' ? 'אתגר חמש המשימות' : 'מעבדה חופשית';
    elements.missionCard.hidden = mode !== 'missions';
    elements.missionProgress.hidden = mode !== 'missions';
    elements.scoreChip.hidden = mode !== 'missions';
    if (mode === 'missions') {
      missionIndex = 0;
      missionAttempts = 0;
      totalAttempts = 0;
      score = 0;
      loadMission();
    } else {
      forces = { ...DEFAULT_FORCES };
      updateAll();
    }
    setScreen('labScreen');
  }

  function loadMission() {
    const mission = missions[missionIndex];
    forces = { ...mission.start };
    missionAttempts = 0;
    solved = false;
    $('missionTitle').textContent = mission.title;
    $('missionText').textContent = mission.text;
    $('missionTarget').textContent = mission.target;
    challengeAidRevealed = false;
    $('missionTargetBadge').hidden = Boolean(mission.challenge);
    $('challengeAidButton').hidden = !mission.challenge;
    $('challengeAidButton').textContent = 'הצגת השקול כרמז';
    $('missionCounter').textContent = `משימה ${missionIndex + 1} מתוך ${missions.length}`;
    $('progressFill').style.width = `${((missionIndex + 1) / missions.length) * 100}%`;
    elements.feedback.textContent = '';
    elements.feedback.className = 'mission-feedback';
    $('checkButton').hidden = false;
    $('nextButton').hidden = true;
    $('nextButton').textContent = missionIndex === missions.length - 1 ? 'לסיכום' : 'למשימה הבאה';
    updateAll();
  }

  function resetCurrent() {
    if (mode === 'missions') loadMission();
    else {
      forces = { ...DEFAULT_FORCES };
      updateAll();
      showToast('הכוחות חזרו למצב ההתחלתי');
    }
  }

  function makeSvg(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function vectorStart(key, value) {
    if (key === 'applied' || key === 'friction') {
      return { x: CENTER.x, y: key === 'applied' ? 180 : 220 };
    }
    return { x: 530, y: 315 };
  }

  function vectorEnd(key, value) {
    const start = vectorStart(key, value);
    if (key === 'applied' || key === 'friction') return { x: start.x + value * FORCE_SCALE, y: start.y };
    if (key === 'normal') return { x: start.x, y: start.y - value * VERTICAL_SCALE };
    return { x: start.x, y: start.y + value * VERTICAL_SCALE };
  }

  function vectorLabel(key, value, end, color) {
    const horizontal = key === 'applied' || key === 'friction';
    const start = vectorStart(key, value);
    const length = Math.hypot(end.x-start.x,end.y-start.y);
    const inside = horizontal && length >= 65;
    const x = horizontal ? (inside ? (start.x+end.x)/2-(value>=0?5:-5) : end.x+(value>=0?34:-34)) : end.x+40;
    const y = horizontal ? end.y : start.y + (key==='normal'?-1:1)*Math.max(22,length/2);
    const group = makeSvg('g', { class: 'vector-label', transform: `translate(${x} ${y})` });
    const rect = makeSvg('rect', { x: -28, y: -11, width: 56, height: 22, rx: 7, fill: '#fff', 'fill-opacity': '.94' });
    const text = makeSvg('text', { x: 0, y: 4, fill: inside ? '#fff' : color, direction: 'ltr', 'unicode-bidi': 'bidi-override', 'text-anchor': 'middle', style:'font-size:12px;font-weight:800' });
    text.textContent = `${displayForce(key, value)} N`;
    if (!inside) group.append(rect);
    group.append(text);
    return group;
  }

  function renderVectors() {
    elements.vectors.innerHTML = '';
    Object.entries(FORCE_META).forEach(([key, meta]) => {
      const start = vectorStart(key, forces[key]);
      const end = vectorEnd(key, forces[key]);
      const group = makeSvg('g', { class: 'force-vector', tabindex: '0', role: 'slider', 'aria-label': `${meta.label}, ${displayForce(key, forces[key])} ניוטון`, 'aria-valuemin': meta.min, 'aria-valuemax': meta.max, 'aria-valuenow': forces[key], 'data-force': key });
      const hit = makeSvg('line', { class: 'hit-area', x1: start.x, y1: start.y, x2: end.x, y2: end.y });
      const length = Math.hypot(end.x-start.x,end.y-start.y);
      const head = Math.min(17,length*.55), half = Math.min(17,length*.6);
      const shaft = Math.min(9,half*.55);
      const angle = Math.atan2(end.y-start.y,end.x-start.x)*180/Math.PI;
      const line = makeSvg('path', { class:'force-shape', d:length ? `M0,${-shaft} H${length-head} V${-half} L${length},0 L${length-head},${half} V${shaft} H0 Z` : '', transform:`translate(${start.x} ${start.y}) rotate(${angle})`, fill:meta.color,stroke:'#17365e','stroke-width':1,'stroke-linejoin':'round' });
      const name = makeSvg('text',{x:meta.axis==='x'?(start.x+end.x)/2:start.x+40,y:meta.axis==='x'?start.y-22:start.y+(key==='normal'?-1:1)*Math.max(22,length/2)-14,'text-anchor':'middle',fill:meta.color,class:'force-name',style:'font-size:11px;font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round'});
      name.textContent = meta.label;
      const handle = makeSvg('circle', { class: 'handle', cx: end.x, cy: end.y, r: 13, fill: 'transparent', stroke: 'transparent' });
      const label = vectorLabel(key, forces[key], end, meta.color);
      group.append(hit, line, handle, name, label);
      group.addEventListener('pointerdown', startDrag);
      group.addEventListener('keydown', vectorKeydown);
      elements.vectors.appendChild(group);
    });
    elements.vectors.querySelectorAll('.vector-label').forEach((label) => { label.style.display = $('showValues').checked ? '' : 'none'; });
  }

  function resultantVisible() {
    const mission = mode === 'missions' ? missions[missionIndex] : null;
    return !mission?.challenge || challengeAidRevealed;
  }

  function renderNet() {
    const net = forceResult();
    const visible = resultantVisible();
    const showArrow = visible && $('showNet').checked;
    const netCard = $('netVectorCard');

    elements.resultant.hidden = !visible;
    $('equationBox').hidden = !visible;
    $('netToggleWrap').hidden = !visible;
    netCard.hidden = !showArrow;
    netCard.classList.toggle('is-zero', net.x === 0 && net.y === 0);
    $('netArrowValue').textContent = `ΣF = ${magnitude(net)} N`;
    elements.netVector.innerHTML = '';

    if (!showArrow || (net.x === 0 && net.y === 0)) return;

    const origin = { x: 90, y: 46 };
    const maxLen = 55;
    const rawLen = Math.hypot(net.x, net.y);
    const scale = Math.min(maxLen / rawLen, .55);
    const endX = origin.x + net.x * scale;
    const endY = origin.y - net.y * scale;
    const line = makeSvg('line', {
      x1: origin.x, y1: origin.y, x2: endX, y2: endY,
      'marker-end': 'url(#miniArrowNet)'
    });
    elements.netVector.append(line);
  }

  function updateReadout() {
    const net = forceResult();
    const direction = directionText(net);
    const netMagnitude = magnitude(net);
    elements.resultant.querySelector('strong').textContent = `${netMagnitude} N`;
    $('resultantFormula').textContent = `|ΣF| = √((${signed(net.x)})² + (${signed(net.y)})²) = ${netMagnitude} N`;
    elements.resultant.querySelector('small').textContent = direction.detail;
    elements.motionBanner.querySelector('strong').textContent = direction.title;
    elements.motionBanner.querySelector('small').textContent = direction.detail;
    elements.motionBanner.classList.toggle('moving', net.x !== 0 || net.y !== 0);
    elements.motionBanner.querySelector('.motion-icon').textContent = net.x > 0 ? '›' : net.x < 0 ? '‹' : net.y !== 0 ? '•' : '•';

    elements.movingBody.getAnimations().forEach(a => a.cancel());
    elements.vectors.getAnimations().forEach(a => a.cancel());
    elements.movingBody.classList.remove('body-moving', 'body-floating');
    elements.movingBody.style.removeProperty('--motion-x');
    elements.movingBody.style.removeProperty('--motion-y');
    if ($('animateBody').checked && !dragging && !matchMedia('(prefers-reduced-motion: reduce)').matches && (net.x !== 0 || net.y !== 0)) {
      const length = Math.hypot(net.x, net.y);
      const x = net.x / length * 160, y = -net.y / length * (net.y < 0 ? 25 : 65);
      const duration = Math.max(1800, 10000 / Math.sqrt(length / 10));
      for (const node of [elements.movingBody, elements.vectors]) {
        node.animate([{transform:'translate(0,0)'},{transform:`translate(${x}px,${y}px)`}], {duration,easing:'ease-in',fill:'forwards'});
      }
    }
  }

  function updateControls() {
    Object.keys(FORCE_META).forEach((key) => {
      $(`${key}Input`).value = forces[key];
      $(`${key}Output`).textContent = `${displayForce(key, forces[key])} N`;
    });
    $('equationX').textContent = `ΣFₓ = ${signed(forces.applied)} ${forces.friction >= 0 ? '+' : '−'} ${Math.abs(forces.friction)} = ${signed(forceResult().x)} N`;
    $('equationY').textContent = `ΣFᵧ = ${forces.normal} − ${forces.weight} = ${signed(forceResult().y)} N`;
    $('scoreValue').textContent = score;
  }

  function updateAll() {
    renderVectors();
    renderNet();
    updateReadout();
    updateControls();
  }

  function clampStep(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(value / 10) * 10));
  }

  function startDrag(event) {
    event.preventDefault();
    dragging = event.currentTarget.dataset.force;
    $('forceCanvas').setPointerCapture(event.pointerId);
    $('forceCanvas').addEventListener('pointermove', moveDrag);
    $('forceCanvas').addEventListener('pointerup', endDrag, { once: true });
    $('forceCanvas').addEventListener('pointercancel', endDrag, { once: true });
    updateAll();
  }

  function moveDrag(event) {
    if (!dragging) return;
    const svg = $('forceCanvas');
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM().inverse());
    const meta = FORCE_META[dragging];
    let value;
    if (meta.axis === 'x') {
      value = (local.x - CENTER.x) / FORCE_SCALE;
    } else if (meta.axis === 'up') value = (315 - local.y) / VERTICAL_SCALE;
    else value = (local.y - 315) / VERTICAL_SCALE;
    forces[dragging] = clampStep(value, meta.min, meta.max);
    updateAll();
  }

  function endDrag(event) {
    event.currentTarget.removeEventListener('pointermove', moveDrag);
    dragging = null;
    updateReadout();
  }

  function vectorKeydown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const key = event.currentTarget.dataset.force;
    const meta = FORCE_META[key];
    const increase = event.key === 'ArrowRight' || event.key === 'ArrowUp';
    forces[key] = clampStep(forces[key] + (increase ? 10 : -10), meta.min, meta.max);
    updateAll();
    requestAnimationFrame(() => elements.vectors.querySelector(`[data-force="${key}"]`)?.focus());
  }

  function checkMission() {
    if (solved) return;
    const mission = missions[missionIndex];
    missionAttempts += 1;
    totalAttempts += 1;
    const net = forceResult();
    if (mission.check(forces, net)) {
      solved = true;
      const gained = missionAttempts === 1 ? 20 : missionAttempts === 2 ? 15 : 10;
      score += gained;
      $('scoreValue').textContent = score;
      elements.feedback.className = 'mission-feedback good';
      elements.feedback.innerHTML = `<strong>מדויק!</strong> השקול והכיוון מתאימים ליעד. קיבלתם ${gained} נקודות.`;
      $('checkButton').hidden = true;
      $('nextButton').hidden = false;
      playSound('successSound');
    } else {
      elements.feedback.className = 'mission-feedback bad';
      elements.feedback.innerHTML = `<strong>עוד כיוון קטן.</strong> ${mission.hint(net)}`;
      playSound('errorSound');
    }
  }

  function revealChallengeAid() {
    const mission = missions[missionIndex];
    if (mode !== 'missions' || !mission.challenge) return;
    challengeAidRevealed = true;
    $('showNet').checked = true;
    $('challengeAidButton').textContent = 'השקול מוצג כרמז';
    updateAll();
    showToast('השקול נפתח כרמז');
  }

  function nextMission() {
    if (missionIndex < missions.length - 1) {
      missionIndex += 1;
      loadMission();
      document.querySelector('.lab-screen').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      finishGame();
    }
  }

  function finishGame() {
    $('finalScore').textContent = score;
    $('correctCount').textContent = missions.length;
    $('attemptCount').textContent = totalAttempts;
    $('endSummary').textContent = score >= 90 ? 'עבודה מצוינת: זיהיתם כיצד כל כוח משנה את השקול.' : score >= 70 ? 'השלמתם את כל המשימות ובניתם הבנה טובה של שקול כוחות.' : 'השלמתם את כל המשימות. נסו שוב כדי להגיע לפתרון בפחות בדיקות.';
    document.querySelector('.score-ring').style.background = `conic-gradient(var(--green) 0 ${score}%, #e5ecee ${score}% 100%)`;
    setScreen('endScreen');
    playSound('finishSound');
  }

  function playSound(id) {
    if (muted) return;
    document.querySelectorAll('audio').forEach((audio) => { audio.pause(); audio.currentTime = 0; });
    $(id).play().catch(() => {});
  }

  function toggleSound() {
    muted = !muted;
    try { localStorage.setItem('prisma-force-muted', String(muted)); } catch (_) {}
    $('soundIcon').src = muted ? 'assets/mute.svg' : 'assets/speaker.svg';
    $('soundButton').setAttribute('aria-label', muted ? 'הפעלת צלילים' : 'השתקת צלילים');
    showToast(muted ? 'הצלילים הושתקו' : 'הצלילים הופעלו');
  }

  function showToast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 1800);
  }

  function openHelp() {
    if (!$('helpDialog').open) $('helpDialog').showModal();
  }

  function closeHelp() {
    $('helpDialog').close();
  }

  function bindEvents() {
    $('missionStart').addEventListener('click', () => setMode('missions'));
    $('exploreStart').addEventListener('click', () => setMode('explore'));
    $('playAgain').addEventListener('click', () => setMode('missions'));
    $('endExplore').addEventListener('click', () => setMode('explore'));
    $('homeButton').addEventListener('click', () => setScreen('startScreen'));
    $('resetButton').addEventListener('click', resetCurrent);
    $('checkButton').addEventListener('click', checkMission);
    $('nextButton').addEventListener('click', nextMission);
    $('challengeAidButton').addEventListener('click', revealChallengeAid);
    $('soundButton').addEventListener('click', toggleSound);
    ['helpButton', 'startHelp'].forEach((id) => $(id).addEventListener('click', openHelp));
    ['closeHelp', 'helpOkay'].forEach((id) => $(id).addEventListener('click', closeHelp));
    $('helpDialog').addEventListener('click', (event) => { if (event.target === $('helpDialog')) closeHelp(); });
    Object.keys(FORCE_META).forEach((key) => {
      $(`${key}Input`).addEventListener('input', (event) => {
        forces[key] = Number(event.target.value);
        updateAll();
      });
    });
    $('showValues').addEventListener('change', renderVectors);
    $('showNet').addEventListener('change', renderNet);
    $('animateBody').addEventListener('change', updateReadout);
  }

  function init() {
    const canvas = $('forceCanvas');
    canvas.querySelectorAll(':scope > rect, .background-art').forEach(node => node.remove());
    const background = makeSvg('image', {href:'assets/landscape.png',x:0,y:0,width:800,height:480,preserveAspectRatio:'xMidYMid slice'});
    canvas.insertBefore(background, elements.movingBody);
    elements.movingBody.innerHTML = '';
    // Use the uploaded transparent bird PNG in the laboratory as well as on the home screen.
    // The bird replaces the cart everywhere in the app.
    elements.movingBody.appendChild(makeSvg('image', {
      href:'assets/bird.png',
      x:246,
      y:140,
      width:308,
      height:308,
      preserveAspectRatio:'xMidYMid meet',
      class:'bird-art'
    }));
    elements.motionBanner.querySelector('.motion-icon').style.display = 'none';
    document.querySelectorAll('#forceCanvas marker').forEach(marker => {
      marker.setAttribute('markerUnits', 'userSpaceOnUse');
      marker.setAttribute('markerWidth', '14');
      marker.setAttribute('markerHeight', '14');
      marker.setAttribute('refX', '10');
    });
    try { muted = localStorage.getItem('prisma-force-muted') === 'true'; } catch (_) {}
    $('soundIcon').src = muted ? 'assets/mute.svg' : 'assets/speaker.svg';
    $('soundButton').setAttribute('aria-label', muted ? 'הפעלת צלילים' : 'השתקת צלילים');
    bindEvents();
    updateAll();
  }

  window.__FORCE_APP__ = { missions, forceResult: (values) => ({ x: values.applied + values.friction, y: values.normal - values.weight }) };
  init();
})();
