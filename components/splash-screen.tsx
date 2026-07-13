"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

/**
 * Full-screen splash that shows the tree logo on first visit.
 * Tries to play the video; if autoplay is blocked or video fails,
 * shows the static logo for 2s instead. Only plays once per session.
 */
export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const checkedRef = useRef(false);
  const endedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    sessionStorage.setItem("splash-shown", "1");
    setFadeOut(true);
    setTimeout(() => setShowSplash(false), 600);
  }, []);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    if (sessionStorage.getItem("splash-shown")) {
      setShowSplash(false);
      return;
    }

    setShowSplash(true);
  }, []);

  // Once splash is visible, try to play the video
  useEffect(() => {
    if (!showSplash) return;

    const video = videoRef.current;
    if (!video) return;

    // Try autoplay — many browsers block it without prior interaction
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setVideoPlaying(true);
        })
        .catch(() => {
          // Autoplay blocked — show static logo for 2s then dismiss
          setTimeout(dismiss, 2000);
        });
    }

    // Safety timeout — if video somehow stalls, dismiss after 6s
    const timeout = setTimeout(dismiss, 6000);
    return () => clearTimeout(timeout);
  }, [showSplash, dismiss]);

  // Allow tap/click to skip
  const handleClick = () => dismiss();

  return (
    <>
      {children}
      {showSplash && (
        <div
          onClick={handleClick}
          className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0f1a] cursor-pointer transition-opacity duration-500 ${
            fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          {/* Static logo — always visible as fallback */}
          {!videoPlaying && (
            <Image
              src="/forestry-demo/logo-dark.png"
              alt="Cascadia & Ramos Forestry"
              width={256}
              height={256}
              className="h-48 w-48 object-contain sm:h-64 sm:w-64"
              priority
            />
          )}
          {/* Video — hidden until it actually starts playing */}
          {/* Asset srcs carry the basePath from next.config.mjs by hand:
              plain <video> and unoptimized <Image> don't get it applied */}
          <video
            ref={videoRef}
            src="/forestry-demo/splash.mp4"
            muted
            playsInline
            preload="auto"
            onPlaying={() => setVideoPlaying(true)}
            onEnded={dismiss}
            className={`h-48 w-48 object-contain sm:h-64 sm:w-64 ${
              videoPlaying ? "block" : "hidden"
            }`}
          />
        </div>
      )}
    </>
  );
}
