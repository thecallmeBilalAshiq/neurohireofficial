"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import "./landing.css";

export default function LandingPage() {
  const [isDark, setIsDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState("home");
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    // Add scroll-smooth to html
    document.documentElement.classList.add("scroll-smooth");

    // Add fonts and external CSS for landing page
    const addLandingPageResources = () => {
      // Check if already added
      if (document.querySelector('link[href*="fonts.googleapis.com"]')) return;

      // Add Google Fonts
      const fontLink1 = document.createElement("link");
      fontLink1.rel = "preconnect";
      fontLink1.href = "https://fonts.googleapis.com";
      document.head.appendChild(fontLink1);

      const fontLink2 = document.createElement("link");
      fontLink2.rel = "preconnect";
      fontLink2.href = "https://fonts.gstatic.com";
      fontLink2.crossOrigin = "anonymous";
      document.head.appendChild(fontLink2);

      const fontLink3 = document.createElement("link");
      fontLink3.href =
        "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&display=swap";
      fontLink3.rel = "stylesheet";
      document.head.appendChild(fontLink3);

      // Add Font Awesome
      const faLink = document.createElement("link");
      faLink.rel = "stylesheet";
      faLink.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
      document.head.appendChild(faLink);

      // Add AOS CSS
      const aosLink = document.createElement("link");
      aosLink.rel = "stylesheet";
      aosLink.href = "https://unpkg.com/aos@next/dist/aos.css";
      document.head.appendChild(aosLink);
    };

    addLandingPageResources();

    // Check for saved theme preference
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (savedTheme === "dark" || (savedTheme === null && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }

    // Handle scroll for header and scroll-to-top button
    const handleScroll = () => {
      const header = document.getElementById("header");
      if (window.scrollY > 50) {
        header?.classList.add("header-scrolled");
      } else {
        header?.classList.remove("header-scrolled");
      }

      // Show/hide scroll to top button
      setShowScrollTop(window.scrollY > 300);

      // Update active section
      const sections = document.querySelectorAll("section");
      sections.forEach((section) => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.scrollY >= sectionTop - 200) {
          setCurrentSection(section.getAttribute("id") || "");
        }
      });
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    if (newTheme) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80,
        behavior: "smooth",
      });
    }
    setMobileMenuOpen(false);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="landing-page-wrapper">
      {/* External Scripts */}
      <Script
        src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof window !== "undefined" && window.particlesJS) {
            setTimeout(() => {
              const particlesElement = document.getElementById("particles-js");
              if (particlesElement) {
                window.particlesJS("particles-js", {
                  particles: {
                    number: {
                      value: 80,
                      density: {
                        enable: true,
                        value_area: 800
                      }
                    },
                    color: { value: "#c026d3" },
                    shape: {
                      type: "circle",
                      stroke: {
                        width: 0,
                        color: "#000000"
                      },
                      polygon: {
                        nb_sides: 5
                      }
                    },
                    opacity: {
                      value: 0.5,
                      random: false,
                      anim: {
                        enable: false,
                        speed: 1,
                        opacity_min: 0.1,
                        sync: false
                      }
                    },
                    size: {
                      value: 3,
                      random: true,
                      anim: {
                        enable: false,
                        speed: 40,
                        size_min: 0.1,
                        sync: false
                      }
                    },
                    line_linked: {
                      enable: true,
                      distance: 150,
                      color: "#7c3aed",
                      opacity: 0.4,
                      width: 1
                    },
                    move: {
                      enable: true,
                      speed: 2,
                      direction: "none",
                      random: false,
                      straight: false,
                      out_mode: "out",
                      bounce: false,
                      attract: {
                        enable: false,
                        rotateX: 600,
                        rotateY: 1200
                      }
                    }
                  },
                  interactivity: {
                    detect_on: "canvas",
                    events: {
                      onhover: {
                        enable: true,
                        mode: "grab"
                      },
                      onclick: {
                        enable: true,
                        mode: "push"
                      },
                      resize: true
                    },
                    modes: {
                      grab: {
                        distance: 140,
                        line_linked: {
                          opacity: 1
                        }
                      },
                      bubble: {
                        distance: 400,
                        size: 40,
                        duration: 2,
                        opacity: 8,
                        speed: 3
                      },
                      repulse: {
                        distance: 200,
                        duration: 0.4
                      },
                      push: {
                        particles_nb: 4
                      },
                      remove: {
                        particles_nb: 2
                      }
                    }
                  },
                  retina_detect: true
                });
              }
            }, 100);
          }
        }}
      />
      <Script src="https://unpkg.com/aos@next/dist/aos.js" strategy="lazyOnload" />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.7.0/vanilla-tilt.min.js"
        strategy="lazyOnload"
        onLoad={() => {
          if (typeof window !== "undefined" && window.VanillaTilt) {
            window.VanillaTilt.init(
              document.querySelectorAll(
                ".team-card, .experience-card, .timeline-item, .contact-info-item"
              ),
              {
                max: 5,
                speed: 400,
                glare: true,
                "max-glare": 0.2,
                scale: 1.02,
                perspective: 1000,
              }
            );
          }
        }}
      />

      {/* Cursor */}
      <div className="cursor"></div>
      <div className="cursor-follower"></div>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button id="scrollToTopBtn" onClick={scrollToTop} aria-label="Scroll to top">
          <i className="fas fa-arrow-up"></i>
        </button>
      )}

      {/* Header/Navbar */}
      <header className="header" id="header">
        <div className="container">
          <nav className="navbar">
            <Link href="/" className="navbar-brand navbar-brand-with-logo" aria-label="NeuroHire Official home">
              <img src="/neurohire-logo.png" alt="NeuroHire Official" />
            </Link>

            <ul className="nav-menu">
              <li className="nav-item">
                <a
                  href="#home"
                  className={`nav-link ${currentSection === "home" ? "active" : ""}`}
                  onClick={(e) => scrollToSection(e, "home")}
                >
                  <span className="nav-number">Home</span>
                </a>
              </li>
              <li className="nav-item">
                <a
                  href="#about"
                  className={`nav-link ${currentSection === "about" ? "active" : ""}`}
                  onClick={(e) => scrollToSection(e, "about")}
                >
                  <span className="nav-number">About</span>
                </a>
              </li>
              <li className="nav-item">
                <a
                  href="#education"
                  className={`nav-link ${currentSection === "education" ? "active" : ""}`}
                  onClick={(e) => scrollToSection(e, "education")}
                >
                  <span className="nav-number">Our Journey</span>
                </a>
              </li>
              <li className="nav-item">
                <a
                  href="#experience"
                  className={`nav-link ${currentSection === "experience" ? "active" : ""}`}
                  onClick={(e) => scrollToSection(e, "experience")}
                >
                  <span className="nav-number">Services</span>
                </a>
              </li>
              <li className="nav-item">
                <a
                  href="#projects"
                  className={`nav-link ${currentSection === "projects" ? "active" : ""}`}
                  onClick={(e) => scrollToSection(e, "projects")}
                >
                  <span className="nav-number">Team</span>
                </a>
              </li>
              <li className="nav-item">
                <a
                  href="#contact"
                  className={`nav-link ${currentSection === "contact" ? "active" : ""}`}
                  onClick={(e) => scrollToSection(e, "contact")}
                >
                  <span className="nav-number">Contact</span>
                </a>
              </li>
              <li className="nav-item" style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginLeft: "1rem" }}>
                <Link href="/auth/login" className="btn btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                  Sign In
                </Link>
                <Link href="/auth/signup" className="btn btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                  Sign Up
                </Link>
              </li>
              <li className="nav-item">
                <button
                  id="theme-toggle"
                  className="theme-toggle"
                  aria-label="Toggle theme"
                  onClick={toggleTheme}
                >
                  <i className={`fas ${isDark ? "fa-sun" : "fa-moon"}`}></i>
                </button>
              </li>
            </ul>

            <button
              id="mobile-menu-btn"
              className="mobile-menu-btn"
              aria-label="Toggle mobile menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <i className={`fas ${mobileMenuOpen ? "fa-times" : "fa-bars"}`}></i>
            </button>
          </nav>
        </div>

        <div id="mobile-menu" className={`mobile-menu ${mobileMenuOpen ? "active" : ""}`}>
          <ul>
            <li>
              <a
                href="#home"
                className="nav-link"
                onClick={(e) => scrollToSection(e, "home")}
              >
                <span className="nav-number">Home</span>
              </a>
            </li>
            <li>
              <a
                href="#about"
                className="nav-link"
                onClick={(e) => scrollToSection(e, "about")}
              >
                <span className="nav-number">About</span>
              </a>
            </li>
            <li>
              <a
                href="#education"
                className="nav-link"
                onClick={(e) => scrollToSection(e, "education")}
              >
                <span className="nav-number">Our Journey</span>
              </a>
            </li>
            <li>
              <a
                href="#experience"
                className="nav-link"
                onClick={(e) => scrollToSection(e, "experience")}
              >
                <span className="nav-number">Services</span>
              </a>
            </li>
            <li>
              <a
                href="#projects"
                className="nav-link"
                onClick={(e) => scrollToSection(e, "projects")}
              >
                <span className="nav-number">Team</span>
              </a>
            </li>
            <li>
              <a
                href="#contact"
                className="nav-link"
                onClick={(e) => scrollToSection(e, "contact")}
              >
                <span className="nav-number">Contact</span>
              </a>
            </li>
            <li style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <Link href="/auth/login" className="btn btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                Sign In
              </Link>
              <Link href="/auth/signup" className="btn btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                Sign Up
              </Link>
            </li>
          </ul>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="hero">
        <div id="particles-js" className="hero-particles"></div>
        <div className="container">
          <div className="hero-grid">
            <div className="hero-content" data-aos="fade-up" data-aos-duration="1000">
              <p className="hero-greeting">Welcome to</p>
              <h1 className="hero-title">
                Neuro<span className="text-gradient">Hire</span>
              </h1>
              <h2 className="hero-subtitle">AI-Powered Hiring Solutions</h2>
              <p className="hero-description">
                <img
                  src="https://readme-typing-svg.herokuapp.com?color=%23FF4B8B&size=30&center=true&vCenter=true&width=650&lines=Hello!+We+are+NeuroHire+Officials;We+make+the+AI-Hiring+Systems%7C+ML+Engineer;Open-Source+Contributors;Hire+Candidates+just+by+one+click+%7C+;"
                  alt="Typing animation"
                />
              </p>
              <div>
                <a
                  href="#contact"
                  className="btn btn-primary"
                  onClick={(e) => scrollToSection(e, "contact")}
                >
                  Get In Touch
                </a>
                <a
                  href="#projects"
                  className="btn btn-outline"
                  style={{ marginLeft: "1rem" }}
                  onClick={(e) => scrollToSection(e, "projects")}
                >
                  View Projects
                </a>
              </div>
              <div className="social-links">
                <a
                  href="https://github.com/neurohireofficial/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <i className="fab fa-github"></i>
                </a>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <i className="fab fa-linkedin-in"></i>
                </a>
                <a href="mailto:methebilalashiq@gmail.com" className="social-link">
                  <i className="fas fa-envelope"></i>
                </a>
                <a href="tel:+923088660209" className="social-link">
                  <i className="fas fa-phone"></i>
                </a>
              </div>
            </div>

            <div className="hero-image-container" data-aos="zoom-in" data-aos-duration="1000">
              <div className="hero-image-wrapper">
                <div className="hero-image-bg"></div>
                <img
                  src="https://www.dropbox.com/scl/fi/txf298g69pwz3bqonphpa/neurohire_hero_image_1765225515989.jpg?rlkey=bjl9r58zq0kwx689v45p389q0&st=s5zhcbu5&raw=1"
                  alt="neurohire"
                  className="hero-image"
                />
                <div className="hero-image-decoration">3+</div>
              </div>
            </div>
          </div>

          {/* Hero Scroll Indicator */}
          <div className="hero-scroll-indicator">
            <span>Scroll Down</span>
            <div className="mouse"></div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="section">
        <div className="container">
          <div className="section-title-container">
            <span className="section-subtitle">
              <b> About NeuroHire </b>
            </span>
            <p className="section-description">
              Revolutionizing recruitment through artificial intelligence and machine learning.
            </p>
          </div>

          <div
            className="about-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "40% 60%",
              gap: "3rem",
              alignItems: "start",
            }}
          >
            <div className="about-image-container" data-aos="fade-right" data-aos-duration="1000">
              <div className="about-image-wrapper">
                <div className="about-image-bg"></div>
                <img
                  src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=600&fit=crop"
                  alt="NeuroHire Team Collaboration"
                  className="about-image"
                />
                <div className="about-image-decoration"></div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginTop: "1.5rem",
                }}
              >
                <div
                  style={{ borderRadius: "12px", overflow: "hidden" }}
                  data-aos="fade-up"
                  data-aos-delay="200"
                >
                  <img
                    src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=250&h=180&fit=crop"
                    alt="AI Technology"
                    style={{ width: "100%", height: "180px", objectFit: "cover" }}
                  />
                </div>
                <div
                  style={{ borderRadius: "12px", overflow: "hidden" }}
                  data-aos="fade-up"
                  data-aos-delay="300"
                >
                  <img
                    src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=250&h=180&fit=crop"
                    alt="Data Analytics"
                    style={{ width: "100%", height: "180px", objectFit: "cover" }}
                  />
                </div>
              </div>
            </div>

            <div className="about-content" data-aos="fade-left" data-aos-duration="1000">
              <h3 className="about-heading">Who We Are</h3>
              <p className="about-text">
                NeuroHire is a cutting-edge AI recruitment platform that transforms the way
                companies discover, evaluate, and hire top talent. Founded by technology
                innovators and HR experts, we combine the power of artificial intelligence with
                human expertise to create the most efficient hiring experience possible.
              </p>

              <div
                className="about-cards"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1.5rem",
                  marginTop: "2rem",
                }}
              >
                <div className="about-card" data-aos="zoom-in" data-aos-duration="800" data-aos-delay="100">
                  <div className="about-card-icon">
                    <i className="fas fa-brain"></i>
                  </div>
                  <h4 className="about-card-title">AI-Powered Screening</h4>
                  <p className="about-card-text">Intelligent candidate evaluation using machine learning</p>
                </div>

                <div className="about-card" data-aos="zoom-in" data-aos-duration="800" data-aos-delay="200">
                  <div className="about-card-icon">
                    <i className="fas fa-users"></i>
                  </div>
                  <h4 className="about-card-title">Smart Matching</h4>
                  <p className="about-card-text">Precision candidate-job matching with advanced algorithms</p>
                </div>

                <div className="about-card" data-aos="zoom-in" data-aos-duration="800" data-aos-delay="300">
                  <div className="about-card-icon">
                    <i className="fas fa-chart-line"></i>
                  </div>
                  <h4 className="about-card-title">Predictive Analytics</h4>
                  <p className="about-card-text">Data-driven insights for better hiring decisions</p>
                </div>

                <div className="about-card" data-aos="zoom-in" data-aos-duration="800" data-aos-delay="400">
                  <div className="about-card-icon">
                    <i className="fas fa-robot"></i>
                  </div>
                  <h4 className="about-card-title">Automated Workflows</h4>
                  <p className="about-card-text">Streamlined recruitment process automation</p>
                </div>
              </div>

              {/* Technology Stack */}
              <div
                className="skills-container"
                style={{ marginTop: "4rem", textAlign: "center" }}
              >
                <h3 className="skills-title" style={{ textAlign: "center" }}>
                  Our Technology Stack
                </h3>
                <div
                  className="skills-grid"
                  style={{ justifyContent: "center", maxWidth: "900px", margin: "0 auto" }}
                >
                  <img
                    src="https://img.shields.io/badge/-Python-3776AB?style=for-the-badge&logo=python&logoColor=white"
                    alt="Python"
                    className="skill-badge"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-delay="100"
                  />
                  <img
                    src="https://img.shields.io/badge/-TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white"
                    alt="TensorFlow"
                    className="skill-badge"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-delay="150"
                  />
                  <img
                    src="https://img.shields.io/badge/-PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white"
                    alt="PyTorch"
                    className="skill-badge"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-delay="200"
                  />
                  <img
                    src="https://img.shields.io/badge/-Machine%20Learning-00A3E0?style=for-the-badge&logo=scikit-learn&logoColor=white"
                    alt="Machine Learning"
                    className="skill-badge"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-delay="250"
                  />
                  <img
                    src="https://img.shields.io/badge/-NLP-43B02A?style=for-the-badge&logo=ai&logoColor=white"
                    alt="NLP"
                    className="skill-badge"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-delay="300"
                  />
                  <img
                    src="https://img.shields.io/badge/-Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white"
                    alt="Node.js"
                    className="skill-badge"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-delay="400"
                  />
                  <img
                    src="https://img.shields.io/badge/-React-61DAFB?style=for-the-badge&logo=react&logoColor=black"
                    alt="React"
                    className="skill-badge"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-delay="450"
                  />
                  <img
                    src="https://img.shields.io/badge/-MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white"
                    alt="MongoDB"
                    className="skill-badge"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-delay="500"
                  />
                  <img
                    src="https://img.shields.io/badge/-n8n-4169E1?style=for-the-badge&logo=-n8n-4169E1?style&logoColor=white"
                    alt="n8n"
                    className="skill-badge"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-delay="550"
                  />
                  <img
                    src="https://img.shields.io/badge/-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white"
                    alt="Docker"
                    className="skill-badge"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-delay="650"
                  />
                  <img
                    src="https://img.shields.io/badge/-OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white"
                    alt="OpenAI"
                    className="skill-badge"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-delay="850"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section id="education" className="section section-bg-muted">
        <div className="container">
          <div className="section-title-container">
            <span className="section-subtitle">Our Journey</span>
            <p className="section-description">
              Key milestones in NeuroHire&apos;s growth and innovation.
            </p>
          </div>

          <div className="timeline-container">
            <div className="timeline-item" data-aos="fade-right" data-aos-duration="1000">
              <div className="timeline-content">
                <span className="timeline-date">
                  <i className="fas fa-calendar-alt"></i> July - August 2025
                </span>
                <h3 className="timeline-title">Launching of Idea</h3>
                <div className="timeline-subtitle">
                  <i className="fas fa-lightbulb"></i> Conceptualization & Vision
                </div>
                <p className="timeline-description">
                  Initiated the NeuroHire project with comprehensive ideation sessions. Defined the
                  core vision of revolutionizing recruitment through AI and identified key market
                  opportunities.
                </p>
              </div>
            </div>

            <div
              className="timeline-item"
              data-aos="fade-left"
              data-aos-duration="1000"
              data-aos-delay="200"
            >
              <div className="timeline-content">
                <span className="timeline-date">
                  <i className="fas fa-calendar-alt"></i> August - October 2025
                </span>
                <h3 className="timeline-title">SRS Document</h3>
                <div className="timeline-subtitle">
                  <i className="fas fa-file-alt"></i> Software Requirements Specification
                </div>
                <p className="timeline-description">
                  Completed comprehensive Software Requirements Specification document. Detailed
                  system architecture, functional requirements, and technical specifications for the
                  AI recruitment platform.
                </p>
              </div>
            </div>

            <div
              className="timeline-item"
              data-aos="fade-right"
              data-aos-duration="1000"
              data-aos-delay="400"
            >
              <div className="timeline-content">
                <span className="timeline-date">
                  <i className="fas fa-calendar-alt"></i> October - December 2025
                </span>
                <h3 className="timeline-title">Front End Development</h3>
                <div className="timeline-subtitle">
                  <i className="fas fa-code"></i> User Interface & Experience
                </div>
                <p className="timeline-description">
                  Built the complete front-end platform with modern React components. Designed
                  intuitive user interfaces for recruiters and candidates with responsive design and
                  seamless interactions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Experience Section */}
      <section id="experience" className="section">
        <div className="container">
          <div className="section-title-container">
            <span className="section-subtitle">Our Services</span>
            <p className="section-description">
              Comprehensive AI-powered recruitment solutions for modern enterprises.
            </p>
          </div>

          <div className="experience-container">
            <div className="experience-card" data-aos="fade-up" data-aos-duration="1000">
              <div className="experience-header">
                <h3 className="experience-company">AI-Powered Candidate Screening</h3>
                <span className="experience-date">
                  <i className="fas fa-star"></i> Premium Service
                </span>
              </div>
              <p className="experience-position">Intelligent Resume Analysis & Candidate Evaluation</p>
              <ul className="experience-responsibilities">
                <li className="experience-responsibility">
                  <i className="fas fa-check-circle"></i>
                  <span>
                    Advanced AI algorithms analyze resumes and extract relevant skills, experience,
                    and qualifications
                  </span>
                </li>
                <li className="experience-responsibility">
                  <i className="fas fa-check-circle"></i>
                  <span>
                    Natural language processing for accurate candidate profile understanding
                  </span>
                </li>
                <li className="experience-responsibility">
                  <i className="fas fa-check-circle"></i>
                  <span>
                    Automated scoring and ranking based on job requirements and company culture fit
                  </span>
                </li>
                <li className="experience-responsibility">
                  <i className="fas fa-check-circle"></i>
                  <span>Reduce screening time by 80% while improving candidate quality</span>
                </li>
              </ul>
            </div>

            <div
              className="experience-card"
              data-aos="fade-up"
              data-aos-duration="1000"
              data-aos-delay="200"
            >
              <div className="experience-header">
                <h3 className="experience-company">Smart Candidate Matching</h3>
                <span className="experience-date">
                  <i className="fas fa-star"></i> Core Feature
                </span>
              </div>
              <p className="experience-position">Precision Matching with Machine Learning</p>
              <ul className="experience-responsibilities">
                <li className="experience-responsibility">
                  <i className="fas fa-check-circle"></i>
                  <span>
                    AI-powered matching algorithms connect perfect candidates with ideal roles
                  </span>
                </li>
                <li className="experience-responsibility">
                  <i className="fas fa-check-circle"></i>
                  <span>
                    Consider skills, experience, culture fit, and career aspirations for optimal
                    matches
                  </span>
                </li>
                <li className="experience-responsibility">
                  <i className="fas fa-check-circle"></i>
                  <span>
                    Continuous learning from hiring outcomes to improve match accuracy
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="projects" className="section section-bg-muted">
        <div className="container">
          <div className="section-title-container">
            <h2 className="section-title">Our Team</h2>
            <p className="section-description">
              Meet the brilliant minds behind NeuroHire. Dedicated to revolutionizing recruitment
              through AI.
            </p>
          </div>

          <div className="team-grid">
            <div className="team-card" data-aos="fade-up" data-aos-duration="1000">
              <div className="team-img-container">
                <img
                  src="https://avatars.githubusercontent.com/u/138978969"
                  alt="Muhammad Bilal Ashiq"
                  className="team-img"
                />
              </div>
              <h3 className="team-name">Muhammad Bilal Ashiq</h3>
              <p className="team-role">Python Developer</p>
              <div className="team-social">
                <a
                  href="https://www.linkedin.com/in/bilal-ashiq/"
                  target="_blank"
                  className="team-social-link"
                  aria-label="LinkedIn"
                >
                  <i className="fab fa-linkedin-in"></i>
                </a>
                <a
                  href="https://github.com/thecallmeBilalAshiq"
                  target="_blank"
                  className="team-social-link"
                  aria-label="GitHub"
                >
                  <i className="fab fa-github"></i>
                </a>
                <a
                  href="https://www.facebook.com/methebilalashiq"
                  target="_blank"
                  className="team-social-link"
                  aria-label="Facebook"
                >
                  <i className="fab fa-facebook-f"></i>
                </a>
                <a
                  href="https://www.instagram.com/methebilalashiq/"
                  target="_blank"
                  className="team-social-link"
                  aria-label="Instagram"
                >
                  <i className="fab fa-instagram"></i>
                </a>
              </div>
            </div>

            <div
              className="team-card"
              data-aos="fade-up"
              data-aos-duration="1000"
              data-aos-delay="200"
            >
              <div className="team-img-container">
                <img
                  src="https://ui-avatars.com/api/?name=Faiez+Tariq&background=43cea2&color=fff&size=256"
                  alt="Faiez Tariq"
                  className="team-img"
                />
              </div>
              <h3 className="team-name">Faiez Tariq</h3>
              <p className="team-role">Node JS Developer</p>
              <div className="team-social">
                <a href="#" className="team-social-link" aria-label="LinkedIn">
                  <i className="fab fa-linkedin-in"></i>
                </a>
                <a href="#" className="team-social-link" aria-label="GitHub">
                  <i className="fab fa-github"></i>
                </a>
                <a href="#" className="team-social-link" aria-label="Facebook">
                  <i className="fab fa-facebook-f"></i>
                </a>
                <a href="#" className="team-social-link" aria-label="Instagram">
                  <i className="fab fa-instagram"></i>
                </a>
              </div>
            </div>

            <div
              className="team-card"
              data-aos="fade-up"
              data-aos-duration="1000"
              data-aos-delay="400"
            >
              <div className="team-img-container">
                <img
                  src="https://ui-avatars.com/api/?name=Buhsra+Abad&background=ff4b8b&color=fff&size=256"
                  alt="Buhsra Abad"
                  className="team-img"
                />
              </div>
              <h3 className="team-name">Buhsra Abad</h3>
              <p className="team-role">Front End Developer</p>
              <div className="team-social">
                <a href="#" className="team-social-link" aria-label="LinkedIn">
                  <i className="fab fa-linkedin-in"></i>
                </a>
                <a href="#" className="team-social-link" aria-label="GitHub">
                  <i className="fab fa-github"></i>
                </a>
                <a href="#" className="team-social-link" aria-label="Facebook">
                  <i className="fab fa-facebook-f"></i>
                </a>
                <a href="#" className="team-social-link" aria-label="Instagram">
                  <i className="fab fa-instagram"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="section">
        <div className="container">
          <div className="section-title-container">
            <h2 className="section-title">Get In Touch</h2>
            <p className="section-description">
              Ready to transform your recruitment process? Contact us today for a consultation or
              demo.
            </p>
          </div>

          <div className="contact-grid">
            <div data-aos="fade-right" data-aos-duration="1000">
              <h3 className="contact-info-title">Contact Information</h3>
              <div className="contact-info-items">
                <div className="contact-info-item">
                  <div className="contact-info-icon">
                    <i className="fas fa-envelope"></i>
                  </div>
                  <div className="contact-info-content">
                    <h3>Email</h3>
                    <a href="mailto:contact@neurohire.ai">contact@neurohire.ai</a>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-info-icon">
                    <i className="fas fa-phone"></i>
                  </div>
                  <div className="contact-info-content">
                    <h3>Phone</h3>
                    <a href="tel:+12025550123">+1 (202) 555-0123</a>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-info-icon">
                    <i className="fas fa-map-marker-alt"></i>
                  </div>
                  <div className="contact-info-content">
                    <h3>Location</h3>
                    <p>San Francisco, CA | Remote-First</p>
                  </div>
                </div>
              </div>
            </div>

            <div data-aos="fade-left" data-aos-duration="1000">
              <div className="contact-form-container">
                <h3 className="contact-form-title">Send Me a Message</h3>
                <div id="form-success" className="form-success">
                  <i className="fas fa-check-circle"></i> Thank you for your message! I&apos;ll get
                  back to you soon.
                </div>
                <form
                  id="contact-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const submitBtn = e.target.querySelector(".submit-btn");
                    const formSuccess = document.getElementById("form-success");
                    const originalBtnText = submitBtn.innerHTML;

                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                    submitBtn.disabled = true;

                    setTimeout(() => {
                      e.target.reset();
                      formSuccess?.classList.add("active");
                      submitBtn.innerHTML = originalBtnText;
                      submitBtn.disabled = false;

                      setTimeout(() => {
                        formSuccess?.classList.remove("active");
                      }, 5000);
                    }, 1500);
                  }}
                >
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="name" className="form-label">
                        Your Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        className="form-control"
                        placeholder="Muhammad Ali"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="email" className="form-label">
                        Your Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className="form-control"
                        placeholder="ali@example.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="subject" className="form-label">
                      Subject
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      className="form-control"
                      placeholder="How can we help you?"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="message" className="form-label">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      className="form-control form-message"
                      placeholder="Your message here..."
                      required
                    ></textarea>
                  </div>
                  <button type="submit" className="submit-btn">
                    <i className="fas fa-paper-plane"></i> Send Message
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div>
              <div className="footer-brand">
                <img src="/neurohire-logo.png" alt="NeuroHire Official" />
              </div>
              <p className="footer-description">
                AI-Powered Recruitment Solutions | Transform Your Hiring Process | Smarter, Faster,
                Better
              </p>
              <div className="footer-social">
                <a
                  href="https://github.com/neurohireofficial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-link"
                >
                  <i className="fab fa-github"></i>
                </a>
                <a
                  href="https://www.linkedin.com/company/neurohire"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-link"
                >
                  <i className="fab fa-linkedin-in"></i>
                </a>
                <a
                  href="https://twitter.com/neurohire"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-link"
                >
                  <i className="fab fa-twitter"></i>
                </a>
                <a
                  href="https://www.youtube.com/@neurohire"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-link"
                >
                  <i className="fab fa-youtube"></i>
                </a>
              </div>
            </div>

            <div>
              <h3 className="footer-heading">Quick Links</h3>
              <div className="footer-links">
                <a
                  href="#home"
                  className="footer-link"
                  onClick={(e) => scrollToSection(e, "home")}
                >
                  <i className="fas fa-chevron-right"></i> Home
                </a>
                <a
                  href="#about"
                  className="footer-link"
                  onClick={(e) => scrollToSection(e, "about")}
                >
                  <i className="fas fa-chevron-right"></i> About
                </a>
                <a
                  href="#education"
                  className="footer-link"
                  onClick={(e) => scrollToSection(e, "education")}
                >
                  <i className="fas fa-chevron-right"></i> Our Journey
                </a>
                <a
                  href="#experience"
                  className="footer-link"
                  onClick={(e) => scrollToSection(e, "experience")}
                >
                  <i className="fas fa-chevron-right"></i> Services
                </a>
                <a
                  href="#projects"
                  className="footer-link"
                  onClick={(e) => scrollToSection(e, "projects")}
                >
                  <i className="fas fa-chevron-right"></i> Team
                </a>
                <a
                  href="#contact"
                  className="footer-link"
                  onClick={(e) => scrollToSection(e, "contact")}
                >
                  <i className="fas fa-chevron-right"></i> Contact
                </a>
              </div>
            </div>

            <div>
              <h3 className="footer-heading">Contact Info</h3>
              <div className="footer-links">
                <a href="mailto:contact@neurohire.ai" className="footer-link">
                  <i className="fas fa-envelope"></i> contact@neurohire.ai
                </a>
                <a href="tel:+12025550123" className="footer-link">
                  <i className="fas fa-phone"></i> +1 (202) 555-0123
                </a>
                <a href="#" className="footer-link">
                  <i className="fas fa-map-marker-alt"></i> San Francisco, CA | Remote-First
                </a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p className="footer-copyright">
              &copy; {new Date().getFullYear()} NeuroHire. All Rights Reserved. | Powered by AI
            </p>
          </div>
        </div>
      </footer>

      {/* Initialize AOS */}
      <Script id="init-aos" strategy="lazyOnload">
        {`
          if (typeof AOS !== 'undefined') {
            AOS.init({
              once: true,
              offset: 100,
              duration: 800
            });
          }
        `}
      </Script>

      {/* Initialize Vanilla Tilt */}
      <Script id="init-tilt" strategy="lazyOnload">
        {`
          if (typeof VanillaTilt !== 'undefined') {
            const tiltElements = document.querySelectorAll('.team-card, .experience-card, .timeline-item, .contact-info-item');
            if (tiltElements.length > 0) {
              VanillaTilt.init(tiltElements, {
                max: 5,
                speed: 400,
                glare: true,
                'max-glare': 0.2,
                scale: 1.02,
                perspective: 1000,
              });
            }
          }
        `}
      </Script>

      {/* Initialize cursor effects */}
      <Script id="init-cursor" strategy="lazyOnload">
        {`
          const cursor = document.querySelector('.cursor');
          const cursorFollower = document.querySelector('.cursor-follower');
          
          if (cursor && cursorFollower) {
            document.addEventListener('mousemove', function(e) {
              cursor.style.left = e.clientX + 'px';
              cursor.style.top = e.clientY + 'px';
              
              setTimeout(function() {
                cursorFollower.style.left = e.clientX + 'px';
                cursorFollower.style.top = e.clientY + 'px';
              }, 100);
            });
            
            document.addEventListener('mousedown', function() {
              cursor.style.transform = 'translate(-50%, -50%) scale(0.8)';
              cursorFollower.style.transform = 'translate(-50%, -50%) scale(0.8)';
            });
            
            document.addEventListener('mouseup', function() {
              cursor.style.transform = 'translate(-50%, -50%) scale(1)';
              cursorFollower.style.transform = 'translate(-50%, -50%) scale(1)';
            });
            
            const links = document.querySelectorAll('a, button, .skill-badge, .project-card');
            links.forEach(link => {
              link.addEventListener('mouseenter', function() {
                cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
                cursor.style.opacity = '0.5';
                cursorFollower.style.width = '60px';
                cursorFollower.style.height = '60px';
                cursorFollower.style.borderColor = 'var(--primary)';
              });
              
              link.addEventListener('mouseleave', function() {
                cursor.style.transform = 'translate(-50%, -50%) scale(1)';
                cursor.style.opacity = '0.7';
                cursorFollower.style.width = '40px';
                cursorFollower.style.height = '40px';
                cursorFollower.style.borderColor = 'var(--primary)';
              });
            });
          }
        `}
      </Script>
    </div>
  );
}
