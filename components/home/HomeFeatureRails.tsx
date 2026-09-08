"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Gift,
  Instagram,
  LockKeyhole,
  Play,
  PlayCircle,
  Sparkles,
  WalletCards,
} from "lucide-react";
import HomeHeading from "./HomeHeading";
import { useSettings } from "@/lib/useSettings";
import { DEFAULT_RESELLER_TASKS, type ResellerTask } from "@/lib/resellerTasks";
import { PRIME_SKILLS_SEED } from "@/lib/primeSkillsSeed";
import { thumbnailOf, type WholesaleVideo } from "@/lib/wholesaleVideos";
import { normalizeImageUrl } from "@/lib/imageUrl";

const taskIcons = [CheckCircle2, Instagram, Gift, WalletCards];

export function HomeResellerTasks() {
  const { settings } = useSettings();
  const configured = (
    settings as typeof settings & { resellerTasks?: ResellerTask[] }
  ).resellerTasks;
  const tasks = (
    configured?.length ? configured : DEFAULT_RESELLER_TASKS
  ).filter((task) => task.active !== false);
  if (!tasks.length) return null;
  return (
    <section className="home-club">
      <HomeHeading>Reseller Club Tasks</HomeHeading>
      <div className="home-rail-note">
        <span>Complete tasks and collect approved points in your wallet.</span>
        <span>
          <LockKeyhole size={11} /> Login required to redeem
        </span>
      </div>
      <div
        className="home-two-row-rail"
        aria-label="Reseller tasks. Swipe horizontally for more."
      >
        {tasks.map((task, index) => {
          const Icon = taskIcons[index % taskIcons.length];
          return (
            <Link
              href={`/reseller/tasks#${encodeURIComponent(task.id)}`}
              className="home-task"
              key={task.id}
            >
              <span
                className={`home-task-icon ${task.id.includes("instagram") ? "instagram" : ""}`}
              >
                <Icon />
              </span>
              <div>
                <h3>{task.title}</h3>
                <p>{task.description}</p>
                <strong>
                  {Number(task.reward || 0) > 0
                    ? `+${Number(task.reward).toLocaleString()} points after approval`
                    : "Automatic progress"}
                </strong>
                <span className="home-task-button">
                  Open task <ArrowRight size={13} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      <Link className="home-view-all" href="/reseller/dashboard">
        Open reseller wallet <ArrowRight size={14} />
      </Link>
    </section>
  );
}

export function HomeWholesaleVideos() {
  const { settings } = useSettings();
  const videos = (
    (settings as typeof settings & { wholesaleVideos?: WholesaleVideo[] })
      .wholesaleVideos || []
  ).filter((video) => video.active !== false);
  if (!videos.length) return null;
  return (
    <section className="home-video-packages">
      <HomeHeading>Wholesale Packages</HomeHeading>
      <div
        className="home-two-row-rail"
        aria-label="Wholesale package videos. Swipe horizontally for more."
      >
        {videos.map((video, index) => {
          const thumbnail = normalizeImageUrl(thumbnailOf(video));
          return (
            <a
              className="home-video-card"
              href={video.url}
              target="_blank"
              rel="noreferrer"
              key={video.id}
            >
              <span className="home-video-image">
                {thumbnail ? (
                  <img src={thumbnail} alt={video.title} loading={index < 2 ? "eager" : "lazy"} className="object-cover" />
                ) : (
                  <PlayCircle size={38} />
                )}
                <i>
                  <Play fill="currentColor" />
                </i>
              </span>
              <span>
                <small>{video.platform}</small>
                <b>{video.title}</b>
                <em>{video.description || "Tap to watch video"}</em>
              </span>
            </a>
          );
        })}
      </div>
      <Link className="home-view-all" href="/wholesale-video-hub">
        View all wholesale videos <ArrowRight size={14} />
      </Link>
    </section>
  );
}

export function HomePrimeSkills() {
  const [items, setItems] = useState(PRIME_SKILLS_SEED);
  useEffect(() => {
    fetch("/api/storefront/read?type=skills", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.skills) && data.skills.length)
          setItems(data.skills);
      })
      .catch(() => undefined);
  }, []);
  const skills = useMemo(
    () =>
      items
        .filter((item) => item.active !== false)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [items],
  );
  if (!skills.length) return null;
  return (
    <section className="home-prime-skills">
      <HomeHeading>Prime Skills</HomeHeading>
      <div
        className="home-two-row-rail"
        aria-label="Prime Skills. Swipe horizontally for more."
      >
        {skills.map((item, index) => {
          const thumbnail = normalizeImageUrl(item.thumbnailUrl);
          return (
            <Link
              className="home-skill-card"
              href={`/skills/${item.id}`}
              key={item.id}
            >
              <span className="home-skill-image">
                {thumbnail ? (
                  <Image
                    src={thumbnail}
                    alt={item.title || "Prime Skill"}
                    fill
                    sizes="(max-width: 600px) 48vw, 300px"
                    priority={index < 2}
                    className="object-cover"
                  />
                ) : (
                  <Sparkles />
                )}
              </span>
              <span>
                <b>{item.title || "Prime Skill"}</b>
                <ArrowRight size={13} />
              </span>
            </Link>
          );
        })}
      </div>
      <Link className="home-view-all" href="/skills">
        View all Prime Skills <ArrowRight size={14} />
      </Link>
    </section>
  );
}
