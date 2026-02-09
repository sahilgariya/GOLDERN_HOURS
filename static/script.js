let timerInterval = null;
let startTime = null;
let prevGolden = false;

// FORMAT TIME HH:MM:SS
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

// START TIMER
function startTimer() {
    if (timerInterval) return;

    startTime = Date.now();
    localStorage.setItem("startTime", startTime);

    timerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        document.getElementById("timer").innerText = formatTime(elapsed);
    }, 1000);

    // notify backend that day started (optional)
    fetch('/start', { method: 'POST' }).catch(() => {});
}

// RESTORE TIMER AFTER REFRESH
function restoreTimer() {
    const savedStart = localStorage.getItem("startTime");
    if (savedStart) {
        startTime = parseInt(savedStart);
        timerInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - startTime;
            document.getElementById("timer").innerText = formatTime(elapsed);
        }, 1000);
    }
}

// Register handlers after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startBtn");

    if (startBtn) {
        startBtn.addEventListener("click", () => {
            startBtn.innerText = "RUNNING";
            startBtn.disabled = true;
            startTimer();
        });
    }

    // Restore timer on load
    restoreTimer();

    // Poll server status for golden hour and synced timer
    async function pollStatus() {
        try {
            const res = await fetch('/status');
            if (!res.ok) return;
            const data = await res.json();

            // Sync timer with server if server reports started
            if (data.started && !timerInterval) {
                // server returns elapsed in seconds
                const elapsedMs = (data.elapsed || 0) * 1000;
                startTime = Date.now() - elapsedMs;
                localStorage.setItem('startTime', startTime);
                timerInterval = setInterval(() => {
                    const now = Date.now();
                    const elapsed = now - startTime;
                    document.getElementById('timer').innerText = formatTime(elapsed);
                }, 1000);
            }

            // Golden hour UI
            const goldenActive = !!data.golden;
            const goldenDiv = document.getElementById('golden');
            if (goldenActive) {
                document.body.classList.add('golden');
                if (goldenDiv) goldenDiv.innerText = 'GOLDEN HOUR!';
            } else {
                document.body.classList.remove('golden');
                if (goldenDiv) goldenDiv.innerText = '';
            }

            // Notify user once when golden hour starts (client-side)
            if (goldenActive && !prevGolden) {
                prevGolden = true;
                if (window.Notification) {
                    if (Notification.permission === 'granted') {
                        new Notification('Golden Hour started!', { body: 'It\'s golden hour now.' });
                    } else if (Notification.permission !== 'denied') {
                        Notification.requestPermission().then(permission => {
                            if (permission === 'granted') {
                                new Notification('Golden Hour started!', { body: 'It\'s golden hour now.' });
                            }
                        });
                    }
                }
            }

            if (!goldenActive) prevGolden = false;
        } catch (e) {
            // ignore network errors
        }
    }

    // initial poll and interval
    pollStatus();
    setInterval(pollStatus, 5000);
});
