document.getElementById('checkBtn').addEventListener('click', async () => {
    const resultDiv = document.getElementById('result');
    const checkBtn = document.getElementById('checkBtn');

    // Replace with your active ngrok URL (remove trailing slash if present '/ at the end)
    const NGROK_BASE_URL = "https://royal-backlit-duct.ngrok-free.dev"; 

    checkBtn.disabled = true;
    resultDiv.innerText = "Analyzing content...";

    try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url) {
            resultDiv.innerText = "Error: Cannot detect active tab.";
            return;
        }

        const url = tab.url;
        let targetEndpoint = "";
        let requestPayload = {};

        // Route 1: YouTube Video
        if (url.includes("youtube.com/watch")) {
            const urlParams = new URLSearchParams(new URL(url).search);
            const videoId = urlParams.get("v");

            if (!videoId) throw new Error("Could not extract YouTube Video ID.");

            targetEndpoint = `${NGROK_BASE_URL}/fact-check-youtube`;
            requestPayload = { video_id: videoId };
            resultDiv.innerText = "Fetching YouTube transcript...";

        // Route 2: Generic Video Sites (TikTok, Instagram, Twitter/X, Vimeo, etc.)
        } else if (
            url.includes("tiktok.com") || 
            url.includes("instagram.com/reel") || 
            url.includes("twitter.com") || 
            url.includes("x.com") || 
            url.includes("vimeo.com")
        ) {
            targetEndpoint = `${NGROK_BASE_URL}/fact-check-video`;
            requestPayload = { url: url };
            resultDiv.innerText = "Extracting video audio & transcribing with Whisper (15-30s)...";

        // Route 3: Standard Webpage Paragraph Text
        } else {
            const injectionResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: scrapeText
            });

            const scrapedText = injectionResults[0]?.result || "";

            if (!scrapedText.trim()) {
                resultDiv.innerText = "No readable paragraph text found on this page.";
                return;
            }

            targetEndpoint = `${NGROK_BASE_URL}/fact-check-text`;
            requestPayload = { text: scrapedText };
            resultDiv.innerText = "Analyzing page text...";
        }

        // Send POST request
        const response = await fetch(targetEndpoint, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true"
            },
            body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
            throw new Error(`Server status code: ${response.status}`);
        }

        const data = await response.json();

        resultDiv.innerHTML = `
            <b>Factual:</b> ${data.factual_percentage}%<br>
            <b>Hoax:</b> ${data.hoax_percentage}%<br><br>
            <b>Analysis:</b><br>${data.analysis}
        `;

    } catch (error) {
        console.error("Extension Error:", error);
        resultDiv.innerText = `Error: ${error.message}`;
    } finally {
        checkBtn.disabled = false;
    }
});

function scrapeText() {
    const paragraphs = Array.from(document.querySelectorAll('p'))
                            .map(p => p.innerText.trim())
                            .filter(text => text.length > 0);
    return paragraphs.join(' ').substring(0, 3000);
}