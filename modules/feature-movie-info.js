// Movie Info Module for BillTube Framework
// Displays movie information with backdrop, poster, and rating when hovering over current title

(function() {
    'use strict';

    const MODULE_ID = 'movie-info';
    const MODULE_NAME = 'Movie Info';
    const MODULE_VERSION = '2.0.0';

    // Configuration
    const CONFIG = {
        CONTAINER_ID: 'btfw-movie-header',
        TITLE_SELECTOR: '#currenttitle',
        TOPBAR_SELECTOR: '.btfw-chat-topbar',
        ENABLE_BACKDROP: true,
        ENABLE_RATING: true,
        SHOW_SUMMARY: true
    };

    // Module state
    let isInitialized = false;
    let movieHeaderElement = null;
    let currentTitle = '';

    /**
     * Get TMDB API key from theme configuration
     */
    function getTMDBKey() {
        try {
            const cfg = (window.BTFW_CONFIG && typeof window.BTFW_CONFIG === "object") ? window.BTFW_CONFIG : {};
            const tmdbObj = (cfg.tmdb && typeof cfg.tmdb === "object") ? cfg.tmdb : {};
            const cfgKey = typeof tmdbObj.apiKey === "string" ? tmdbObj.apiKey.trim() : "";
            const legacyCfg = typeof cfg.tmdbKey === "string" ? cfg.tmdbKey.trim() : "";
            
            let lsKey = "";
            try { 
                lsKey = (localStorage.getItem("btfw:tmdb:key") || "").trim(); 
            } catch(_) {}
            
            const g = v => (v == null ? "" : String(v)).trim();
            const globalKey = g(window.TMDB_API_KEY) || g(window.BTFW_TMDB_KEY) || g(window.tmdb_key);
            const bodyKey = (document.body?.dataset?.tmdbKey || "").trim();
            
            const key = cfgKey || legacyCfg || lsKey || globalKey || bodyKey;
            return key || null;
        } catch(_) { 
            return null; 
        }
    }

    /**
     * Initialize the Movie Info module
     */
    function init() {
        if (isInitialized) {
            return;
        }

        try {
            const topbar = document.querySelector(CONFIG.TOPBAR_SELECTOR);
            
            if (!topbar) {
                setTimeout(init, 500);
                return;
            }

            createMovieHeader();
            setupEventListeners();
            injectStyles();
            
            isInitialized = true;
            setTimeout(handleMediaChange, 100);
            
        } catch (error) {
            setTimeout(init, 1000);
        }
    }

    // Create the movie header container
    function createMovieHeader() {
        const topbar = document.querySelector(CONFIG.TOPBAR_SELECTOR);
        if (!topbar) {
            throw new Error('Chat topbar not found');
        }

        // Remove existing movie header if it exists
        const existingHeader = document.getElementById(CONFIG.CONTAINER_ID);
        if (existingHeader) {
            existingHeader.remove();
        }

        // Create new movie header
        movieHeaderElement = document.createElement('div');
        movieHeaderElement.id = CONFIG.CONTAINER_ID;
        movieHeaderElement.className = 'btfw-movie-header hide';
        
        // Insert after the topbar
        topbar.insertAdjacentElement('afterend', movieHeaderElement);
    }

    // Setup event listeners for module functionality
    function setupEventListeners() {
        // Listen for media changes via socket
        if (window.socket && typeof window.socket.on === 'function') {
            window.socket.on('changeMedia', handleMediaChange);
        } else {
            let retryCount = 0;
            const retrySocket = () => {
                retryCount++;
                if (window.socket && typeof window.socket.on === 'function') {
                    window.socket.on('changeMedia', handleMediaChange);
                } else if (retryCount < 10) {
                    setTimeout(retrySocket, 1000);
                }
            };
            setTimeout(retrySocket, 2000);
        }

        // Setup hover effects for showing/hiding movie info
        setupHoverEffects();

        // Handle window resize for responsive design
        window.addEventListener('resize', debounce(handleResize, 250));
    }

    // Setup hover effects for the title and movie header
    function setupHoverEffects() {
        const titleElement = document.querySelector(CONFIG.TITLE_SELECTOR);
        
        if (titleElement) {
            titleElement.addEventListener('mouseenter', showMovieHeader);
            titleElement.addEventListener('mouseleave', hideMovieHeaderDelayed);
        } else {
            const observer = new MutationObserver(() => {
                const titleEl = document.querySelector(CONFIG.TITLE_SELECTOR);
                if (titleEl) {
                    titleEl.addEventListener('mouseenter', showMovieHeader);
                    titleEl.addEventListener('mouseleave', hideMovieHeaderDelayed);
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        if (movieHeaderElement) {
            movieHeaderElement.addEventListener('mouseenter', cancelHideTimer);
            movieHeaderElement.addEventListener('mouseleave', hideMovieHeaderDelayed);
        }
    }

    let hideTimer;

    function showMovieHeader() {
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        
        if (movieHeaderElement) {
            movieHeaderElement.classList.remove('hide');
            movieHeaderElement.classList.add('show');
        }
    }

    function hideMovieHeaderDelayed() {
        hideTimer = setTimeout(() => {
            if (movieHeaderElement) {
                movieHeaderElement.classList.remove('show');
                movieHeaderElement.classList.add('hide');
                
                // Remove hide class after animation completes to reset state
                setTimeout(() => {
                    if (movieHeaderElement && movieHeaderElement.classList.contains('hide')) {
                        movieHeaderElement.classList.remove('hide');
                    }
                }, 300);
            }
        }, 300);
    }

    function cancelHideTimer() {
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
    }

    // Handle media changes
    async function handleMediaChange() {
        const titleElement = document.querySelector(CONFIG.TITLE_SELECTOR);
        
        if (!titleElement || !movieHeaderElement) {
            return;
        }

        const newTitle = titleElement.textContent?.trim() || '';
        
        // Don't refetch if title hasn't changed
        if (newTitle === currentTitle) {
            return;
        }

        currentTitle = newTitle;

        if (!newTitle) {
            resetMovieHeader();
            return;
        }

        try {
            showLoadingState();
            const movieInfo = await fetchMovieInfo(newTitle);
            displayMovieInfo(movieInfo);
        } catch (error) {
            showErrorState();
        }
    }

    // Clean movie title by removing unwanted words
    function cleanMovieTitle(title) {
        const unwantedWords = ['Extended', 'Director\'s Cut', 'Directors Cut', 'Unrated', 'Theatrical Cut'];
        let cleanTitle = title;

        unwantedWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(regex, '');
        });

        return cleanTitle.replace(/\s{2,}/g, ' ').trim();
    }

    // Fetch movie information from TMDB
    async function fetchMovieInfo(movieTitle) {
    const apiKey = getTMDBKey();
    
    if (!apiKey) {
        throw new Error('TMDB API key not configured. Please set it in Theme Settings â†’ Integrations');
    }

    // Try to extract year in parentheses first: "Movie Title (1992)"
    let match = movieTitle.match(/(.+)\s*\((\d{4})\)/);
    let title = match ? match[1].trim() : movieTitle;
    let year = match ? match[2] : '';

    // If no parentheses year found, try standalone year: "Movie Title 1992"
    if (!year) {
        match = movieTitle.match(/(.+?)\s+(\d{4})\s*$/);
        if (match) {
            title = match[1].trim();
            year = match[2];
        }
    }

    const cleanTitle = cleanMovieTitle(title);
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}&year=${year}`;

    try {
        const response = await fetch(searchUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data?.results?.length > 0) {
            const movie = data.results[0];
            return {
                title: movieTitle,
                backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
                poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                summary: movie.overview || '',
                rating: movie.vote_average || 0,
                releaseDate: movie.release_date || '',
                voteCount: movie.vote_count || 0
            };
        }
    } catch (error) {
        throw error;
    }

    return {
        title: movieTitle,
        backdrop: null,
        poster: null,
        summary: '',
        rating: 0,
        releaseDate: '',
        voteCount: 0
    };
}

    // Show loading state
    function showLoadingState() {
        if (!movieHeaderElement) return;

        resetBackdrop();
        movieHeaderElement.innerHTML = `
            <div class="btfw-movie-content">
                <div class="btfw-movie-loading">
                    <i class="fa fa-spinner fa-spin"></i>
                    <p>Loading movie information...</p>
                </div>
            </div>
        `;
    }

    // Show error state
    function showErrorState() {
        if (!movieHeaderElement) return;

        resetBackdrop();
        movieHeaderElement.innerHTML = `
            <div class="btfw-movie-content">
                <div class="btfw-movie-error">
                    <i class="fa fa-exclamation-triangle"></i>
                    <p>Unable to fetch movie information</p>
                    <small>Check TMDB API key in Theme Settings</small>
                </div>
            </div>
        `;
    }

    // Reset movie header to default state
    function resetMovieHeader() {
        if (!movieHeaderElement) return;

        resetBackdrop();
        movieHeaderElement.innerHTML = `
            <div class="btfw-movie-content">
                <p>No movie information available</p>
            </div>
        `;
    }

    // Reset backdrop style
    function resetBackdrop() {
        if (!movieHeaderElement) return;

        movieHeaderElement.style.backgroundImage = '';
        movieHeaderElement.style.backgroundColor = '';
    }

    // Display movie information
    function displayMovieInfo(movie) {
        if (!movieHeaderElement) return;

        // Clear existing content
        movieHeaderElement.innerHTML = '';

        // Set backdrop if available and enabled
        if (CONFIG.ENABLE_BACKDROP && movie.backdrop) {
            movieHeaderElement.style.backgroundImage = `url(${movie.backdrop})`;
            movieHeaderElement.style.backgroundSize = 'cover';
            movieHeaderElement.style.backgroundPosition = 'center';
        } else {
            resetBackdrop();
        }

        // Create overlay for better text readability
        const overlay = document.createElement('div');
        overlay.className = 'btfw-movie-overlay';
        movieHeaderElement.appendChild(overlay);

        // Create content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'btfw-movie-content';
        movieHeaderElement.appendChild(contentDiv);

        // Add poster if available
        if (movie.poster) {
            const posterEl = document.createElement('img');
            posterEl.src = movie.poster;
            posterEl.alt = `${movie.title} Poster`;
            posterEl.className = 'btfw-movie-poster';
            contentDiv.appendChild(posterEl);
        }

        // Add movie details container
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'btfw-movie-details';
        contentDiv.appendChild(detailsDiv);

        // Add title
        const titleEl = document.createElement('h2');
        titleEl.textContent = movie.title;
        titleEl.className = 'btfw-movie-title';
        detailsDiv.appendChild(titleEl);

        // Add summary if available and enabled
        if (CONFIG.SHOW_SUMMARY && movie.summary) {
            const summaryEl = document.createElement('p');
            summaryEl.textContent = movie.summary;
            summaryEl.className = 'btfw-movie-summary';
            detailsDiv.appendChild(summaryEl);
        }

        // Add rating if available and enabled
        if (CONFIG.ENABLE_RATING && movie.rating > 0) {
            const ratingEl = createRatingElement(movie.rating, movie.voteCount);
            contentDiv.appendChild(ratingEl);
        }
    }

    // Create rating element with circular progress
    function createRatingElement(rating, voteCount) {
        const container = document.createElement('div');
        container.className = 'btfw-movie-rating';

        const percentage = Math.round(rating * 10);
        const color = getRatingColor(percentage);

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "60");
        svg.setAttribute("height", "60");
        svg.setAttribute("viewBox", "0 0 60 60");

        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (rating / 10) * circumference;

        // Background circle
        const circleBg = document.createElementNS(svgNS, "circle");
        circleBg.setAttribute("cx", "30");
        circleBg.setAttribute("cy", "30");
        circleBg.setAttribute("r", radius.toString());
        circleBg.setAttribute("stroke", "#2a2a2a");
        circleBg.setAttribute("stroke-width", "4");
        circleBg.setAttribute("fill", "#1a1a1a");
        svg.appendChild(circleBg);

        // Progress circle
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", "30");
        circle.setAttribute("cy", "30");
        circle.setAttribute("r", radius.toString());
        circle.setAttribute("stroke", color);
        circle.setAttribute("stroke-width", "3");
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke-dasharray", circumference.toString());
        circle.setAttribute("stroke-dashoffset", offset.toString());
        circle.setAttribute("transform", "rotate(-90 30 30)");
        circle.setAttribute("stroke-linecap", "round");
        svg.appendChild(circle);

        // Rating text
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", "50%");
        text.setAttribute("y", "50%");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("fill", "#fff");
        text.setAttribute("font-size", "10");
        text.setAttribute("font-weight", "bold");
        text.textContent = `${percentage}%`;
        svg.appendChild(text);

        container.appendChild(svg);

        // Add vote count if available
        if (voteCount > 0) {
            const voteEl = document.createElement('div');
            voteEl.className = 'btfw-movie-votes';
            voteEl.textContent = `${voteCount.toLocaleString()} votes`;
            container.appendChild(voteEl);
        }

        return container;
    }

    // Get color based on rating percentage
    function getRatingColor(rating) {
        const clampedRating = Math.max(0, Math.min(rating, 100));
        
        if (clampedRating >= 70) return '#4caf50';      // Green
        if (clampedRating >= 50) return '#ff9800';      // Orange
        return '#f44336';                               // Red
    }

    // Handle window resize
    function handleResize() {
        // Adjust layout for mobile if needed
        if (movieHeaderElement) {
            const isMobile = window.innerWidth <= 768;
            movieHeaderElement.classList.toggle('btfw-mobile', isMobile);
        }
    }

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Inject CSS styles
    function injectStyles() {
        const css = `
        /* Movie Info Module Styles */
        .btfw-movie-header {
            position: absolute;
            top: 44px;
            right: 0;
            height: auto;
            width: 100%;
            max-width: 90vw;
            background: rgba(20, 20, 20, 0.95);
            border-radius: 0 0 12px 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            z-index: 1000;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
            pointer-events: none;
        }

        .btfw-movie-header.show {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
            animation: slideInDown 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        .btfw-movie-header.hide {
            animation: slideOutUp 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
        }

        @keyframes slideInDown {
            0% {
                opacity: 0;
                transform: translateY(-30px) scale(0.9);
            }
            60% {
                opacity: 0.8;
                transform: translateY(5px) scale(1.02);
            }
            100% {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        @keyframes slideOutUp {
            0% {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            100% {
                opacity: 0;
                transform: translateY(-25px) scale(0.95);
            }
        }

        .btfw-movie-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
                135deg, 
                rgba(0, 0, 0, 0.7) 0%, 
                rgba(0, 0, 0, 0.5) 50%, 
                rgba(0, 0, 0, 0.8) 100%
            );
            z-index: 1;
        }

        .btfw-movie-content {
            position: relative;
            z-index: 2;
            padding: 10px;
            display: flex;
            gap: 15px;
            min-height: 160px;
        }

        .btfw-movie-poster {
            width: 100px;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            flex-shrink: 0;
        }

        .btfw-movie-details {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .btfw-movie-title {
            color: #fff;
            font-size: 1.2em;
            font-weight: 600;
            margin: 0;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
            line-height: 1.3;
        }

        .btfw-movie-summary {
            color: #e0e0e0;
            font-size: 0.85em;
            line-height: 1.5;
            margin: 0;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
            display: -webkit-box;
            -webkit-line-clamp: 4;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .btfw-movie-rating {
            position: sticky;
            bottom: 16px;
            right: 16px;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 4px;
            justify-content: flex-end;
        }

        .btfw-movie-votes {
            color: #ccc;
            font-size: 0.7em;
            text-align: center;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        }

        .btfw-movie-loading,
        .btfw-movie-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            color: #ccc;
            text-align: center;
            min-height: 120px;
        }

        .btfw-movie-loading i,
        .btfw-movie-error i {
            font-size: 2em;
            opacity: 0.7;
        }

        .btfw-movie-error i {
            color: #ff6b6b;
        }

        .btfw-movie-error small {
            font-size: 0.8em;
            color: #aaa;
        }

        /* Mobile adjustments */
        @media (max-width: 768px) {
            .btfw-movie-header {
                width: 100%;
                right: 0;
                left: 0;
                border-radius: 0;
            }

            .btfw-movie-content {
                padding: 16px;
                flex-direction: column;
                min-height: auto;
            }

            .btfw-movie-poster {
                width: 80px;
                align-self: center;
            }

            .btfw-movie-rating {
                position: static;
                align-self: center;
                margin-top: 12px;
            }

            .btfw-movie-summary {
                -webkit-line-clamp: 3;
            }
        }

        /* Hover effect for current title */
        ${CONFIG.TITLE_SELECTOR}:hover {
            color: #4fc3f7 !important;
            transition: color 0.2s ease;
        }
        `;

        const styleElement = document.createElement('style');
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    }

    // Cleanup function
    function cleanup() {
        if (movieHeaderElement) {
            movieHeaderElement.remove();
            movieHeaderElement = null;
        }

        if (window.socket && typeof window.socket.off === 'function') {
            window.socket.off('changeMedia', handleMediaChange);
        }

        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }

        isInitialized = false;
    }

    window.MovieInfoModule = {
        init,
        cleanup,
        isInitialized: () => isInitialized,
        moduleInfo: {
            id: MODULE_ID,
            name: MODULE_NAME,
            version: MODULE_VERSION
        }
    };

    function registerMovieInfoModule() {
        if (!window.BTFW || typeof BTFW.define !== 'function') {
            setTimeout(registerMovieInfoModule, 100);
            return;
        }
        BTFW.define('feature:movie-info', [], async () => {
            init();
            return window.MovieInfoModule;
        });
    }
    registerMovieInfoModule();

})();