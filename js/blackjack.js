/* Blackjack game (vanilla JS)
   - Uses card PNGs in /images/PNG-cards-1.3/
   - Persists stats in localStorage under key 'blackjack_stats_v1'
   - Exposes clean modules: Deck, Hand, UI
*/
(function(){
  // Config
  const CARD_PATH = 'images/PNG-cards-1.3/';
  const STATS_KEY = 'blackjack_stats_v1';

  // DOM
  const creditsEl = document.getElementById('bjCredits');
  const betEl = document.getElementById('bjBet');
  const dealBtn = document.getElementById('bjDeal');
  const hitBtn = document.getElementById('bjHit');
  const standBtn = document.getElementById('bjStand');
  const saveBtn = document.getElementById('bjSave');
  const nameInput = document.getElementById('bjName');
  const dealerHandEl = document.getElementById('dealerHand');
  const playerHandEl = document.getElementById('playerHand');
  const statusEl = document.getElementById('bjStatus') || (function(){ const d=document.createElement('div'); d.id='bjStatus'; if(playerHandEl && playerHandEl.parentNode){ playerHandEl.parentNode.insertBefore(d, playerHandEl); } return d; })();

  // Stats and persistence
  let stats = { credits: 1000, wins:0, losses:0, games:0 };
  function loadStats(){
    try{
      const raw = localStorage.getItem(STATS_KEY);
      if(raw){ stats = Object.assign(stats, JSON.parse(raw)); }
    }catch(e){ console.warn('loadStats',e); }
    updateCreditsUI();
  }
  function saveStats(){
    try{ localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }catch(e){ console.warn('saveStats',e); }
  }
  function updateCreditsUI(){ creditsEl.textContent = stats.credits; }

  // Expose a read-only getter so other scripts (e.g. save handlers) don't rely on DOM text
  try{
    window.getBlackjackCredits = function(){ return stats.credits; };
    window.getBlackjackRoundsPlayed = function(){ return Math.max(1, stats.games || 0); };
    window.getBlackjackMaxBet = function(){
      try{
        const v = parseInt(betEl && betEl.value ? betEl.value : '0', 10);
        return Number.isFinite(v) && v > 0 ? v : 1;
      }catch(e){ return 1; }
    };
  }catch(e){ /* ignore */ }

  // Deck factory
  function buildDeck(){
    const suits = ['clubs','diamonds','hearts','spades'];
    const ranks = ['ace','2','3','4','5','6','7','8','9','10','jack','queen','king'];
    const cards = [];
    for(const s of suits){
      for(const r of ranks){
        const filename = `${r}_of_${s}.png`;
        cards.push({rank:r,suit:s,src: CARD_PATH + filename});
      }
    }
    return cards;
  }
  function shuffle(deck){
    for(let i=deck.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [deck[i],deck[j]]=[deck[j],deck[i]];
    }
  }

  // Hand value
  function handValue(cards){
    let total=0; let aces=0;
    for(const c of cards){
      if(!c || typeof c.rank === 'undefined') continue;
      const rRaw = String(c.rank).toLowerCase().trim();
      if(rRaw==='jack' || rRaw==='queen' || rRaw==='king') total += 10;
      else if(rRaw==='ace'){ total += 11; aces++; }
      else if(/^\d+$/.test(rRaw)) total += parseInt(rRaw,10);
      else {
        // unknown rank (e.g. 'hidden') — ignore for counting
        continue;
      }
    }
    while(total>21 && aces>0){ total -= 10; aces--; }
    return total;
  }

  // UI helpers: create card img positioned at deck, animate to target
  const deckAnchor = document.createElement('div');
  deckAnchor.id = 'bj-deck-anchor';
  deckAnchor.style.position='fixed'; deckAnchor.style.right='20px'; deckAnchor.style.top='120px'; deckAnchor.style.width='48px'; deckAnchor.style.height='64px';
  deckAnchor.style.pointerEvents='none'; document.body.appendChild(deckAnchor);

  // Win popup
  const winPopup = document.getElementById('bjWinPopup');
  const winMessage = document.getElementById('bjWinMessage');
  const winClose = document.getElementById('bjWinClose');
  function showWinPopup(text){
    if(!winPopup) return;
    if(winMessage) winMessage.textContent = text || 'Nice hand!';
    winPopup.classList.add('show');
    winPopup.setAttribute('aria-hidden','false');
  }
  function hideWinPopup(){
    if(!winPopup) return;
    winPopup.classList.remove('show');
    winPopup.setAttribute('aria-hidden','true');
  }
  winClose && winClose.addEventListener('click', hideWinPopup);

  function createCardEl(card){
    const img = document.createElement('img');
    img.src = card.src; img.className = 'bj-card';
    img.style.position = 'fixed'; img.style.width = '84px'; img.style.height = '116px'; img.style.left = '0'; img.style.top = '0';
    img.style.transform = 'translate(0,0) scale(1)'; img.style.transition = 'transform 420ms cubic-bezier(.2,.9,.25,1), opacity 260ms ease';
    img.dataset.rank = card.rank; img.dataset.suit = card.suit; img.dataset.src = card.src;
    document.body.appendChild(img);
    return img;
  }

  function animateDealTo(el, targetContainer, delay=0){
    // el is an img positioned at deckAnchor; compute target center and translate
    const deckRect = deckAnchor.getBoundingClientRect();
    const targetRect = targetContainer.getBoundingClientRect();
    const startX = deckRect.left + deckRect.width/2 - 42; // card width/2
    const startY = deckRect.top + deckRect.height/2 - 58;
    el.style.left = startX + 'px'; el.style.top = startY + 'px'; el.style.opacity = '1';
    // compute destination point (stacking inside container)
    const destX = targetRect.left + 20 + (targetContainer.children.length * 28);
    const destY = targetRect.top + 8;
    // add a small random rotate for a more natural deal
    const angle = (Math.random() * 8 - 4).toFixed(2);
    el.classList.add('dealing');
    requestAnimationFrame(()=>{
      el.style.transitionDelay = delay + 'ms';
      el.style.transform = `translate(${destX - startX}px, ${destY - startY}px) rotate(${angle}deg) scale(1)`;
    });
    return new Promise(res=> setTimeout(()=>{ el.classList.remove('dealing'); res(); }, 420 + delay));
  }

  function placeCardInContainer(el, container){
    // Move element into container DOM and clear inline positioning
    el.style.transition = '';
    el.style.left = ''; el.style.top = ''; el.style.position = '';
    el.style.transform = '';
    el.classList.add('placed');
    container.appendChild(el);
  }

  // Flip animation for dealer hidden card
  function flipCard(imgEl, faceSrc){
    imgEl.classList.add('bj-flip');
    // swap src mid-flip
    imgEl.addEventListener('transitionend', function once(){
      imgEl.removeEventListener('transitionend', once);
      // after half flip, change image
      imgEl.src = faceSrc;
      imgEl.classList.remove('bj-flip');
    });
  }

  // Game state
  let deck = [];
  let dealerCards = [];
  let playerCards = [];
  let dealerHiddenEl = null; // DOM element for hidden card
  let inRound = false; let currentBet = 0;
  let autoDealActive = false;
  let roundCleared = true; // becomes false when a round is active and before resetTable finishes

  // Reset the table. If `immediate` is true, remove card elements synchronously
  // otherwise animate them away first. This guarantees no lingering DOM nodes.
  function resetTable(immediate=false){
    inRound = false; currentBet = 0;
    // select all card elements (placed or in-flight) and remove deterministically
    const allCards = Array.from(document.querySelectorAll('.bj-card'));
    if(immediate){
      allCards.forEach(c=>{ try{ c.remove(); }catch(e){} });
    } else {
      allCards.forEach((c,i)=>{
        try{
          c.style.transition = 'transform 360ms ease, opacity 360ms ease';
          c.style.transform = 'translateY(14px) scale(.6)';
          c.style.opacity = '0';
          setTimeout(()=>{ try{ c.remove(); }catch(e){} }, 380 + i*20);
        }catch(e){}
      });
    }
    dealerCards = []; playerCards = [];
    // ensure containers cleared immediately so layout doesn't hold old nodes
    dealerHandEl.innerHTML = '';
    if(playerHandEl) playerHandEl.innerHTML = '';
    dealerHiddenEl = null;
    updateControls();
    setStatus('Place your bet and deal.');
    updateHandValues();
    // mark that table is now cleared
    roundCleared = true;
  }

  function setStatus(msg){ statusEl.textContent = msg; }

  function updateControls(){
    betEl.disabled = inRound;
    dealBtn.disabled = inRound;
    hitBtn.disabled = !inRound;
    standBtn.disabled = !inRound;
    // disable presets while in a round
    const presets = document.querySelectorAll('[data-preset]');
    presets.forEach(b=> b.disabled = inRound);
    const autoBtn = document.getElementById('bjAutoDeal');
    if(autoBtn) autoBtn.disabled = false; // always allow toggling
  }

  function waitForRoundEnd(){
    return new Promise(res=>{
      const iv = setInterval(()=>{
        if(!inRound && roundCleared){ clearInterval(iv); res(); }
      }, 120);
    });
  }

  async function startRound(){
    // validate bet
    const bet = parseInt(betEl.value || betEl.options[betEl.selectedIndex].value,10) || 0;
    if(bet <= 0 || bet > stats.credits){ alert('Invalid bet'); return; }
    // mark that a new round is starting and table is not cleared
    roundCleared = false;
    currentBet = bet; inRound = true; stats.credits -= bet; updateCreditsUI(); saveStats();
    updateControls(); setStatus('Dealing...');
    // prepare deck
    deck = buildDeck(); shuffle(deck);
    // deal sequence: player, dealer, player, dealer(hidden)
    // player card 1
    const p1 = deck.pop(); playerCards.push(p1);
    const el1 = createCardEl(p1);
    await animateDealTo(el1, playerHandEl, 50); placeCardInContainer(el1, playerHandEl);
    updateHandValues();
    // dealer card 1 (visible)
    const d1 = deck.pop(); dealerCards.push(d1);
    const el2 = createCardEl(d1);
    await animateDealTo(el2, dealerHandEl, 120); placeCardInContainer(el2, dealerHandEl);
    updateHandValues();
    // player card 2
    const p2 = deck.pop(); playerCards.push(p2);
    const el3 = createCardEl(p2);
    await animateDealTo(el3, playerHandEl, 200); placeCardInContainer(el3, playerHandEl);
    updateHandValues();
    // dealer hidden card (face-down) - use card back image
    const d2 = deck.pop(); dealerCards.push(d2);
    const hidden = createCardEl({src: CARD_PATH + 'card back black.png', rank:'hidden', suit:'',});
    // position to dealer
    await animateDealTo(hidden, dealerHandEl, 280);
    placeCardInContainer(hidden, dealerHandEl);
    dealerHiddenEl = hidden; // keep reference
    updateHandValues();

    setStatus('Your move');
    // check instant blackjack
    const pv = handValue(playerCards); const dv = handValue([dealerCards[0]]);
    if(pv === 21){
      // reveal dealer card
      revealDealerCard();
      const dealerHasBlackjack = handValue(dealerCards) === 21;
      if(dealerHasBlackjack){ // push
        stats.credits += currentBet; setStatus('Push — both have Blackjack');
      } else { // player blackjack pays 3:2
        const payout = Math.floor(currentBet * 1.5);
        stats.credits += currentBet + payout; stats.wins++; setStatus('Blackjack! You win.');
        showWinPopup(`Blackjack! +${currentBet + payout} chips`);
      }
      stats.games++; saveStats(); updateCreditsUI(); inRound=false; updateControls();
      // Let the player see the result briefly then clear the table
      setTimeout(()=> resetTable(true), 1200);
      return;
    }
  }

  function revealDealerCard(){
    if(!dealerHiddenEl) return;
    // flip animation: swap image to actual face
    const face = dealerCards[1] && dealerCards[1].src;
    if(!face) return;
    dealerHiddenEl.style.opacity = '1';
    // use CSS class flip + swap on transition end
    const el = dealerHiddenEl;
    let swapped = false;
    const onDone = () => {
      if(swapped) return;
      swapped = true;
      el.src = face;
      el.classList.remove('bj-flip');
      updateHandValues();
    };
    el.addEventListener('transitionend', function once(){
      el.removeEventListener('transitionend', once);
      onDone();
    });
    el.classList.add('bj-flip');
    // fallback in case transitionend doesn't fire
    setTimeout(onDone, 300);
    dealerHiddenEl = null;
  }

  // Utility to update visible hand totals in the UI
  function updateHandValues(){
    try{
      const pValEl = document.getElementById('bjPlayerVal');
      const dValEl = document.getElementById('bjDealerVal');
      if(pValEl) pValEl.textContent = (isNaN(handValue(playerCards))?0:handValue(playerCards));
      if(dValEl){
        // if dealer hidden card exists, show only visible card value
        if(inRound && dealerCards.length>0 && dealerHiddenEl) dValEl.textContent = (isNaN(handValue([dealerCards[0]]))?0:handValue([dealerCards[0]])) + ' (visible)';
        else dValEl.textContent = (isNaN(handValue(dealerCards))?0:handValue(dealerCards));
      }
    }catch(e){/* ignore */}
  }

  async function playerHit(){
    if(!inRound) return;
    const card = deck.pop(); playerCards.push(card);
    const el = createCardEl(card);
    await animateDealTo(el, playerHandEl, 50); placeCardInContainer(el, playerHandEl);
    updateHandValues();
    const val = handValue(playerCards);
    if(val > 21){ // bust
      revealDealerCard(); stats.losses++; stats.games++; saveStats(); setStatus('You busted — lose.'); inRound=false; updateControls();
      // clear table shortly after showing result
      setTimeout(()=> resetTable(true), 1200);
      return;
    }
    if(val === 21){ setStatus('21! Stand or continue.'); }
  }

  async function playerStand(){
    if(!inRound) return;
    revealDealerCard(); // show hidden
    revealDealerCard();
    let dv = handValue(dealerCards);
    while(dv < 17){
      await new Promise(r=>setTimeout(r,420));
      const card = deck.pop(); dealerCards.push(card);
      const el = createCardEl(card);
      await animateDealTo(el, dealerHandEl, 60); placeCardInContainer(el, dealerHandEl);
      updateHandValues();
      dv = handValue(dealerCards);
    }
    // evaluate
    const pv = handValue(playerCards);
    const finalDv = handValue(dealerCards);
    if(finalDv > 21 || pv > finalDv){ // player wins
      // check blackjack payout already handled earlier
      stats.credits += currentBet * 2; stats.wins++; setStatus('You win!');
      showWinPopup(`You win! +${currentBet * 2} chips`);
    } else if(pv === finalDv){ // push
      stats.credits += currentBet; setStatus('Push (tie)');
    } else { stats.losses++; setStatus('Dealer wins.'); }
    stats.games++; saveStats(); updateCreditsUI(); inRound=false; updateControls();
    // keep cards visible briefly, then remove deterministically
    setTimeout(()=> resetTable(true), 1200);
  }

  // Attach events
  dealBtn && dealBtn.addEventListener('click', ()=>{ startRound().catch(e=>console.error(e)); });
  hitBtn && hitBtn.addEventListener('click', ()=> playerHit());
  standBtn && standBtn.addEventListener('click', ()=> playerStand());
  // preset bet buttons
  Array.from(document.querySelectorAll('[data-preset]')).forEach(b=>{
    b.addEventListener('click', ()=>{
      const v = Number(b.dataset.preset) || 0; if(betEl) betEl.value = v;
    });
  });
  // All-In
  const allInBtn = document.getElementById('bjAllIn');
  allInBtn && allInBtn.addEventListener('click', ()=>{
    try{ if(betEl) betEl.value = Math.max(1, stats.credits); }catch(e){}
  });

  // Auto-Deal loop
  const autoBtn = document.getElementById('bjAutoDeal');
  autoBtn && autoBtn.addEventListener('click', async ()=>{
    autoDealActive = !autoDealActive;
    autoBtn.textContent = autoDealActive ? 'Stop Auto' : 'Auto-Deal';
    if(autoDealActive){
      // run consecutive rounds until stopped or credits exhausted
      while(autoDealActive){
        const bet = parseInt(betEl.value || 0,10) || 0;
        if(bet <= 0 || bet > stats.credits){ autoDealActive = false; autoBtn.textContent='Auto-Deal'; break; }
        try{
          await startRound();
          await waitForRoundEnd();
          // small pause between rounds
          await new Promise(r=>setTimeout(r, 600));
        }catch(e){ console.error(e); autoDealActive=false; autoBtn.textContent='Auto-Deal'; }
      }
    }
  });
  saveBtn && saveBtn.addEventListener('click', async ()=>{
    // Save score to Firestore if available (page already has Firestore code)
    try{ if(window.isNameBlocked && window.isNameBlocked(nameInput.value)){ alert('Name blocked'); return; } }catch(e){}
    // For now just clear name (Firestore wiring exists elsewhere)
    nameInput.value = '';
  });

  // Init
  loadStats(); setStatus('Place your bet and deal.'); updateControls();

})();
