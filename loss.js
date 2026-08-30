(function () {
  if (document.body.dataset.page !== 'loss') return;

  const form = document.getElementById('loss-form');
  const errorEl = document.getElementById('loss-error');
  const resultsEl = document.getElementById('loss-results');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    errorEl.textContent = '';
    resultsEl.classList.add('hidden');

    const A = parseFloat(document.getElementById('total-bags').value);
    const B = parseFloat(document.getElementById('total-weight').value);
    const C = parseFloat(document.getElementById('current-bags').value);
    const D = parseFloat(document.getElementById('current-weight').value);
    const E = parseFloat(document.getElementById('target-loss').value);

    if ([A, B, C, D, E].some(function (v) { return isNaN(v) || v < 0; })) {
      errorEl.textContent = 'Please fill all fields with valid non-negative numbers.';
      return;
    }

    if (!Number.isInteger(A) || !Number.isInteger(C)) {
      errorEl.textContent = 'Total Bag and Issue or Receipt Bag must be whole numbers.';
      return;
    }

    if (A === 0 || B === 0 || C === 0 || D === 0) {
      errorEl.textContent = 'Total Bag, Total Weight, Issue or Receipt Bag and Issue or Receipt Weight must be greater than zero.';
      return;
    }

    const avgTotalWeightPerBag = B / A;
    const avgCurrentWeightPerBag = D / C;

    const runningLoss = (avgTotalWeightPerBag - avgCurrentWeightPerBag) * 200;
    const finalLoss = (E / B) * 100;
    const requiredWeight = B - D - E;
    const requiredBag = Math.abs(Math.round(requiredWeight / avgCurrentWeightPerBag));
    const requiredOriginalBags = A - C;
    const expectedMadeUpBags = Math.max(0, requiredBag - requiredOriginalBags);

    document.getElementById('running-loss').textContent = runningLoss.toFixed(3);
    document.getElementById('final-loss').textContent = finalLoss.toFixed(3);
    document.getElementById('required-weight').textContent = requiredWeight.toFixed(5);
    document.getElementById('required-bags').textContent = requiredBag;
    document.getElementById('required-original-bags').textContent = requiredOriginalBags;
    document.getElementById('madeup-bags').textContent = expectedMadeUpBags;

    resultsEl.classList.remove('hidden');
  });
})();
