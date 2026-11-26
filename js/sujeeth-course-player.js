/* Sujeeth Foundation Course Player
 *
 * One-line install on a Power Pages course page:
 * <script defer src="https://www.sujeeth.org/js/sujeeth-course-player.js"
 *   data-course-id="<online-course-guid>" data-progress-write="true"></script>
 *
 * The player runs in the Power Pages page's origin. It reads only the records
 * the signed-in visitor is permitted to access through the portal Web API.
 */
(function () {
  "use strict";

  if (window.__sjfCoursePlayerLoaded) return;
  window.__sjfCoursePlayerLoaded = true;

  var script = document.currentScript || document.querySelector('script[src*="sujeeth-course-player"]');
  var scriptSrc = script && script.src ? script.src : "https://www.sujeeth.org/js/sujeeth-course-player.js";
  var cssUrl = (script && script.getAttribute("data-css-url")) ||
    new URL("../css/powerpages/sujeeth-foundation-course-player.css", scriptSrc).href;
  var cfg = {
    courseId: script && script.getAttribute("data-course-id"),
    courseName: (script && script.getAttribute("data-course-name")) || "",
    contactId: script && script.getAttribute("data-contact-id"),
    apiRoot: (script && script.getAttribute("data-api-root")) || "/_api",
    allowProgressWrite: script && script.getAttribute("data-progress-write") === "true",
    requireEnrollment: script && script.getAttribute("data-require-enrollment") === "true",
    subscribeUrl: script && script.getAttribute("data-subscribe-url"),
    paymentsUrl: (script && script.getAttribute("data-payments-url")) || "",
    signInUrl: (script && script.getAttribute("data-sign-in-url")) || "/SignIn",
    allowRichContent: script && script.getAttribute("data-rich-content") === "true"
  };

  var entity = {
    sections: "suj_onlinecoursesections",
    activities: "suj_onlinecourseactivities",
    enrollments: "suj_onlinecourseenrollments",
    progress: "suj_onlinecourseactivityprogresses"
  };
  var state = { validDays: null, course: null, sections: [], activities: [], progress: [], enrollment: null, pendingProgress: {}, activeSectionId: null, mobileNavigationOpen: false };

  function guid(value) { return String(value || "").replace(/[{}]/g, ""); }
  function query(value) { return encodeURIComponent(value); }
  function odataString(value) { return "'" + String(value || "").replace(/'/g, "''") + "'"; }
  function value(record, name) { return record && record[name] != null ? record[name] : ""; }
  function byOrder(a, b) { return Number(a.order || 0) - Number(b.order || 0) || String(a.name).localeCompare(String(b.name)); }
  function safeUrl(raw) {
    if (!String(raw || "").trim()) return null;
    try {
      var url = new URL(raw, window.location.href);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch (_) { return null; }
  }
  function videoUrl(raw) {
    var url = safeUrl(raw);
    if (!url) return null;
    var parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return "https://www.youtube.com/embed/" + parsed.pathname.slice(1);
    if (/^(www\.)?youtube\.com$/.test(parsed.hostname)) {
      var id = parsed.searchParams.get("v");
      return id ? "https://www.youtube.com/embed/" + id : url;
    }
    if (/^(www\.)?vimeo\.com$/.test(parsed.hostname)) return "https://player.vimeo.com/video" + parsed.pathname;
    return url;
  }
  function isSharePointUrl(raw) {
    try {
      var parsed = new URL(raw);
      return /(^|\.)sharepoint\.com$/i.test(parsed.hostname);
    } catch (_) { return false; }
  }

  function token() {
    return new Promise(function (resolve, reject) {
      if (!window.shell || typeof window.shell.getTokenDeferred !== "function") {
        reject(new Error("Power Pages request token is unavailable."));
        return;
      }
      window.shell.getTokenDeferred().done(resolve).fail(reject);
    });
  }

  function request(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    options.headers.Accept = "application/json";
    if (!options.method || options.method === "GET") return fetch(url, options);
    return token().then(function (csrf) {
      options.headers.__RequestVerificationToken = csrf;
      options.headers["Content-Type"] = "application/json";
      return fetch(url, options);
    });
  }

  function readAll(url) {
    return request(url).then(function (response) {
      if (!response.ok) throw new Error("Could not load course data (" + response.status + ").");
      return response.json();
    }).then(function collect(data) {
      var rows = data.value || [];
      if (!data["@odata.nextLink"]) return rows;
      return readAll(data["@odata.nextLink"]).then(function (next) { return rows.concat(next); });
    });
  }

  function api(path) { return cfg.apiRoot.replace(/\/$/, "") + "/" + path; }
  function setText(node, text) { node.textContent = text == null ? "" : String(text); }
  function element(name, className, text) {
    var node = document.createElement(name);
    if (className) node.className = className;
    if (text != null) setText(node, text);
    return node;
  }

  function load() {
    var courseFilter = "_suj_online_course_value eq " + guid(cfg.courseId);
    var courseFilterById = "&$filter=" + query("suj_onlinecourseid eq " + guid(cfg.courseId));
    var courseUrl = api("suj_onlinecourses?$select=suj_onlinecourseid,suj_name,suj_description,suj_completion_valid_days,suj_end_survey_threshold_percent" + courseFilterById);
    // If the validity column is not in the Web API fields yet, load the course without it
    // (completions then never expire) instead of breaking the whole player.
    var courseRequest = readAll(courseUrl).catch(function () {
      return readAll(api("suj_onlinecourses?$select=suj_onlinecourseid,suj_name,suj_description" + courseFilterById));
    });
    var sectionUrl = api(entity.sections + "?$select=suj_onlinecoursesectionid,suj_name,suj_display_order,suj_description,suj_videourl,suj_subscription_access,_suj_prerequisite_activity_value&$filter=" + query(courseFilter) + "&$orderby=suj_display_order asc");
    var requests = [courseRequest, readAll(sectionUrl)];
    var canCheckEnrollment = Boolean(guid(cfg.contactId));
    if (canCheckEnrollment) requests.push(readAll(enrollmentUrl()));
    return Promise.all(requests).then(function (result) {
      state.course = result[0][0] || null;
      var days = Number(value(state.course, "suj_completion_valid_days"));
      state.validDays = days > 0 ? days : null;
      state.sections = result[1].map(function (row) {
        return {
          id: guid(value(row, "suj_onlinecoursesectionid")),
          name: value(row, "suj_name"),
          order: value(row, "suj_display_order"),
          description: value(row, "suj_description"),
          videoUrl: value(row, "suj_videourl"),
          subscriptionAccess: value(row, "suj_subscription_access"),
          prerequisiteId: guid(value(row, "_suj_prerequisite_activity_value"))
        };
      }).sort(byOrder);
      state.enrollment = canCheckEnrollment ? (result[2][0] || null) : null;
      return Promise.all(state.sections.map(function (section) {
        var filter = "_suj_online_course_section_value eq " + section.id;
        var fields = "suj_onlinecourseactivityid,suj_name,suj_display_order,suj_content,suj_external_url";
        return readAll(api(entity.activities + "?$select=" + fields + "&$filter=" + query(filter) + "&$orderby=suj_display_order asc"));
      }));
    }).then(function (activityGroups) {
      state.activities = activityGroups.reduce(function (all, rows, index) {
        return all.concat(rows.map(function (row) {
          return {
            id: guid(value(row, "suj_onlinecourseactivityid")), sectionId: state.sections[index].id,
            name: value(row, "suj_name"), order: value(row, "suj_display_order"),
            content: value(row, "suj_content"), url: value(row, "suj_external_url")
          };
        }));
      }, []);
      var fields = "suj_onlinecourseactivityprogressid,_suj_online_course_activity_value,suj_completed_on";
      var progressUrl = api(entity.progress + "?$select=" + fields);
      if (state.enrollment) {
        var enrollmentId = guid(value(state.enrollment, "suj_onlinecourseenrollmentid"));
        progressUrl += "&$filter=" + query("_suj_online_course_enrollment_value eq " + enrollmentId);
      }
      return readAll(progressUrl);
    }).then(function (progress) {
      state.progress = progress.map(function (row) {
        return { id: guid(value(row, "suj_onlinecourseactivityprogressid")), activityId: guid(value(row, "_suj_online_course_activity_value")), completedOn: value(row, "suj_completed_on") };
      });
    });
  }

  // The most recent completion for an activity, whether or not it has expired.
  function progressFor(activityId) {
    return state.progress.filter(function (item) { return item.activityId === activityId; })
      .sort(function (a, b) { return String(b.completedOn || "").localeCompare(String(a.completedOn || "")); })[0];
  }
  function expiresOn(item) {
    if (!state.validDays || !item || !item.completedOn) return null;
    return new Date(new Date(item.completedOn).getTime() + state.validDays * 86400000);
  }
  function isExpired(activity) {
    var item = progressFor(activity.id), end = expiresOn(item);
    return Boolean(item && item.completedOn && end && end.getTime() <= Date.now());
  }
  function isComplete(activity) {
    var item = progressFor(activity.id);
    return Boolean(item && item.completedOn && !isExpired(activity));
  }
  function sectionActivities(sectionId) { return state.activities.filter(function (activity) { return activity.sectionId === sectionId; }).sort(byOrder); }
  function sectionCompletion(sectionId) {
    var activities = sectionActivities(sectionId);
    return { completed: activities.filter(isComplete).length, total: activities.length };
  }
  function overallCompletion() { return { completed: state.activities.filter(isComplete).length, total: state.activities.length }; }
  function activityById(id) { return state.activities.find(function (activity) { return activity.id === id; }); }
  function prerequisiteLocked(section) {
    if (!section.prerequisiteId) return false;
    var prerequisite = activityById(section.prerequisiteId);
    return !prerequisite || !isComplete(prerequisite);
  }
  function subscriptionLocked(section) { return Number(section.subscriptionAccess) === 100000001 && !state.enrollment; }
  function sectionLocked(section) { return prerequisiteLocked(section) || subscriptionLocked(section); }

  function enrollmentUrl() {
    var courseFilter = "_suj_online_course_value eq " + guid(cfg.courseId);
    return api(entity.enrollments + "?$select=suj_onlinecourseenrollmentid,suj_access_status,suj_completed_on&$filter=" + query(courseFilter + " and suj_access_status eq 100000000"));
  }
  function refreshEnrollment() {
    if (!guid(cfg.contactId)) return Promise.resolve(null);
    return readAll(enrollmentUrl()).then(function (rows) { state.enrollment = rows[0] || null; return state.enrollment; });
  }

  // Payments service. The browser never chooses an environment or an amount: it sends the
  // course, the coupon text and the signed-in contact, and the service decides the charge.
  function payments(path, body) {
    var root = String(cfg.paymentsUrl).replace(/\/$/, "");
    return fetch(root + "/" + path, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) { var error = new Error(data.error || "The payment service returned " + response.status + "."); error.status = response.status; throw error; }
        return data;
      });
    });
  }
  function money(amount, currency) {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(Number(amount)); }
    catch (_) { return "$" + Number(amount).toFixed(2); }
  }
  function pageUrlWith(flag) {
    var url = new URL(window.location.href);
    ["sf_payment", "token", "PayerID"].forEach(function (name) { url.searchParams.delete(name); });
    if (flag) url.searchParams.set("sf_payment", flag);
    url.hash = "";
    return url.href;
  }
  function isPayPalUrl(raw) {
    try { var u = new URL(raw); return u.protocol === "https:" && /(^|\.)paypal\.com$/i.test(u.hostname); } catch (_) { return false; }
  }

  function render(root) {
    root.replaceChildren();
    root.className = "sf-course-player";
    var header = element("header", "sf-course-player__header");
    var heading = element("h1", "sf-course-player__title", cfg.courseName || value(state.course, "suj_name") || "Course");
    var overall = element("div", "sf-course-player__overall");
    header.append(heading, overall);
    var layout = element("div", "sf-course-player__layout");
    var navigation = element("nav", "sf-course-player__navigation");
    navigation.setAttribute("aria-label", "Course sections");
    var content = element("main", "sf-course-player__content");
    layout.append(navigation, content);
    root.append(header, layout);

    function drawOverall() {
      var total = overallCompletion();
      var percent = total.total ? Math.round((total.completed / total.total) * 100) : 0;
      overall.replaceChildren();
      overall.append(element("span", "sf-course-player__overall-label", total.completed + " of " + total.total + " complete"));
      var meter = element("div", "sf-course-player__meter");
      meter.setAttribute("role", "progressbar"); meter.setAttribute("aria-valuemin", "0"); meter.setAttribute("aria-valuemax", "100"); meter.setAttribute("aria-valuenow", String(percent));
      var fill = element("span", "sf-course-player__meter-fill"); fill.style.width = percent + "%";
      meter.appendChild(fill); overall.appendChild(meter);
      var threshold = state.course && state.course.suj_end_survey_threshold_percent;
      if (cfg.contactId && total.total && threshold != null && threshold !== "" &&
          Number(threshold) >= 0 && Number(threshold) <= 100 &&
          total.completed * 100 >= Number(threshold) * total.total) {
        var certificateButton = element("button", "sf-course-player__complete-button", "Continue to my certificates");
        certificateButton.type = "button";
        var certificateMessage = element("p", "sf-course-player__notice");
        certificateMessage.setAttribute("role", "status");
        certificateButton.addEventListener("click", function () {
          certificateButton.disabled = true;
          setText(certificateMessage, "Preparing your certificate…");
          ensureCertificateAward().then(function () {
            window.location.assign("/MyCertificates/");
          }).catch(function (error) {
            certificateButton.disabled = false;
            setText(certificateMessage, error.message || "We could not prepare your certificate. Please try again.");
          });
        });
        overall.append(certificateButton, certificateMessage);
      }
    }

    function ensureCertificateAward() {
      var courseId = guid(cfg.courseId), contactId = guid(cfg.contactId);
      var certificateFilter = "_suj_online_course_value eq " + courseId + " and statecode eq 0";
      return readAll(api("suj_certificates?$select=suj_certificateid,suj_name&$filter=" + query(certificateFilter)))
        .then(function (certificates) {
          if (certificates.length !== 1) throw new Error("This course needs exactly one active certificate before it can be added.");
          var certificate = certificates[0], certificateId = guid(certificate.suj_certificateid);
          var awardFilter = "_suj_certificate_value eq " + certificateId + " and _suj_contact_value eq " + contactId;
          var awardUrl = api("suj_certificateawards?$select=suj_certificateawardid,suj_award_status&$filter=" + query(awardFilter));
          function existingAward() {
            return readAll(awardUrl).then(function (awards) {
              if (!awards.length) return false;
              if (awards.some(function (award) { return Number(award.suj_award_status) === 100000002; })) {
                throw new Error("This certificate was revoked. Please contact the Foundation for help.");
              }
              return true;
            });
          }
          return existingAward().then(function (exists) {
            if (exists) return;
            var award = {
              suj_name: certificate.suj_name,
              suj_award_status: 100000000,
              "suj_Certificate@odata.bind": "/suj_certificates(" + certificateId + ")",
              "suj_Contact@odata.bind": "/contacts(" + contactId + ")"
            };
            return request(api("suj_certificateawards"), { method: "POST", body: JSON.stringify(award) })
              .then(function (response) {
                if (response.ok) return;
                // A concurrent request can create the award first; reuse it if present.
                return existingAward().then(function (found) {
                  if (!found) return responseError(response, "Could not create the certificate award");
                });
              });
          });
        });
    }

    function drawNavigation() {
      navigation.replaceChildren();
      navigation.classList.toggle("is-mobile-open", state.mobileNavigationOpen);
      var mobileToggle = element("button", "sf-course-player__mobile-toggle", "Course sections · " + (state.activeSectionId ? (state.sections.findIndex(function (section) { return section.id === state.activeSectionId; }) + 1) : 1) + " of " + state.sections.length);
      mobileToggle.type = "button";
      mobileToggle.setAttribute("aria-expanded", String(state.mobileNavigationOpen));
      mobileToggle.addEventListener("click", function () { state.mobileNavigationOpen = !state.mobileNavigationOpen; drawNavigation(); });
      navigation.appendChild(mobileToggle);
      state.sections.forEach(function (section) {
        var focused = section.id === state.activeSectionId;
        var locked = sectionLocked(section);
        var group = element("section", "sf-course-player__section" + (focused ? " is-active" : "") + (locked ? " is-locked" : ""));
        var count = sectionCompletion(section.id);
        var label = element("button", "sf-course-player__section-title", section.order + ". " + section.name);
        label.type = "button"; label.setAttribute("aria-expanded", String(focused));
        if (prerequisiteLocked(section)) {
          var prerequisite = activityById(section.prerequisiteId);
          var message = "Opens after " + (prerequisite ? prerequisite.name : "the prerequisite activity");
          var lock = element("span", "sf-course-player__prerequisite-lock", "🔒");
          lock.setAttribute("aria-hidden", "true"); label.prepend(lock);
          label.setAttribute("aria-disabled", "true"); label.title = message;
          label.setAttribute("aria-label", section.order + ". " + section.name + ". " + message);
          group.classList.add("is-prerequisite-locked");
        } else if (locked) label.setAttribute("aria-label", section.order + ". " + section.name + " — subscription only");
        label.addEventListener("click", function () {
          if (prerequisiteLocked(section)) return;
          if (subscriptionLocked(section)) { openSubscriptionModal(section); return; }
          state.activeSectionId = section.id;
          if (window.matchMedia("(max-width: 780px)").matches) state.mobileNavigationOpen = false;
          drawNavigation(); drawContent();
        });
        var status = element("span", "sf-course-player__section-status", count.completed + "/" + count.total);
        label.appendChild(status);
        if (!prerequisiteLocked(section) && subscriptionLocked(section)) label.appendChild(element("span", "sf-course-player__locked-badge", "Subscription"));
        group.appendChild(label);
        if (!focused) { navigation.appendChild(group); return; }
        var list = element("ol", "sf-course-player__activity-list");
        sectionActivities(section.id).forEach(function (activity) {
          var item = element("li", "sf-course-player__activity-item");
          var button = element("button", "sf-course-player__activity-link", activity.name);
          button.type = "button"; button.dataset.activityId = activity.id;
          if (isComplete(activity)) button.classList.add("is-complete");
          button.addEventListener("click", function () { openActivity(activity); });
          item.appendChild(button); list.appendChild(item);
        });
        group.appendChild(list); navigation.appendChild(group);
      });
    }

    function drawContent() {
      content.replaceChildren();
      var section = state.sections.find(function (item) { return item.id === state.activeSectionId && !sectionLocked(item); }) || state.sections.find(function (item) { return !sectionLocked(item); });
      if (!section) { state.activeSectionId = null; content.appendChild(element("p", "sf-course-player__empty", state.sections.length ? "No sections are available yet." : "This course does not have any sections yet.")); return; }
      state.activeSectionId = section.id;
      content.appendChild(element("p", "sf-course-player__eyebrow", "Section " + section.order));
      content.appendChild(element("h2", "sf-course-player__section-heading", section.name));
      if (section.description) content.appendChild(element("p", "sf-course-player__section-description", section.description));
      var video = videoUrl(section.videoUrl);
      if (video) {
        if (isSharePointUrl(video)) {
          var videoNotice = element("div", "sf-course-player__video-link");
          videoNotice.appendChild(element("p", "", "This video is stored in SharePoint and must open in a new tab."));
          var videoLink = element("a", "sf-course-player__resource", "Open section video");
          videoLink.href = video; videoLink.target = "_blank"; videoLink.rel = "noopener noreferrer"; videoNotice.appendChild(videoLink);
          content.appendChild(videoNotice);
        } else {
          var frame = document.createElement("iframe");
          frame.className = "sf-course-player__video"; frame.src = video; frame.title = section.name + " video";
          frame.setAttribute("allowfullscreen", ""); frame.setAttribute("loading", "lazy");
          content.appendChild(frame);
        }
      } else content.appendChild(element("p", "sf-course-player__empty", "The section video will appear here."));
    }

    function openSubscriptionModal(section) {
      var overlay = element("div", "sf-course-player__modal-backdrop");
      var dialog = element("section", "sf-course-player__modal sf-course-player__subscription-modal");
      dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-label", "Subscription required");
      var close = element("button", "sf-course-player__modal-close", "Close"); close.type = "button";
      function dismiss() { overlay.remove(); document.removeEventListener("keydown", onKey); }
      function onKey(event) { if (event.key === "Escape") dismiss(); }
      close.addEventListener("click", dismiss);
      overlay.addEventListener("click", function (event) { if (event.target === overlay) dismiss(); });
      document.addEventListener("keydown", onKey);
      var title = element("h2", "sf-course-player__modal-title", "Continue with Career Ascent");
      var body = element("div", "sf-course-player__modal-body");
      dialog.append(close, title, body); overlay.appendChild(dialog); document.body.appendChild(overlay); close.focus();
      drawSubscribe(body, title, section, dismiss);
    }

    // Payment modal. Views: sign-in, fallback link, checkout (quote + coupon + pay), success.
    function drawSubscribe(body, title, section, dismiss) {
      body.replaceChildren();
      var intro = element("p", "", (section ? "“" + section.name + "”" : "This section") + " is for subscribers. Pay once and your access never expires.");
      body.appendChild(intro);

      if (!guid(cfg.contactId)) {
        body.appendChild(element("p", "", "Sign in to subscribe, then you can pay and unlock every section."));
        var signIn = element("a", "sf-course-player__resource", "Sign in");
        signIn.href = cfg.signInUrl + (cfg.signInUrl.indexOf("?") === -1 ? "?" : "&") + "returnUrl=" + encodeURIComponent(window.location.pathname + window.location.search);
        body.appendChild(signIn); return;
      }
      if (!cfg.paymentsUrl) {
        var fallback = safeUrl(cfg.subscribeUrl);
        body.appendChild(element("p", "", "Subscribe to unlock this section and the rest of the on-demand course."));
        if (fallback) { var link = element("a", "sf-course-player__resource", "Subscribe"); link.href = fallback; link.target = "_self"; body.appendChild(link); }
        return;
      }

      var couponApplied = "";
      var quoteData = null;
      var summary = element("dl", "sf-course-player__price-summary");
      var couponRow = element("form", "sf-course-player__coupon");
      var couponLabel = element("label", "sf-course-player__coupon-label", "Coupon code");
      var couponInput = element("input", "sf-course-player__coupon-input");
      couponInput.type = "text"; couponInput.autocomplete = "off"; couponInput.autocapitalize = "characters"; couponInput.spellcheck = false; couponInput.maxLength = 60;
      couponInput.id = "sf-coupon-" + Math.random().toString(36).slice(2); couponLabel.htmlFor = couponInput.id;
      var apply = element("button", "sf-course-player__coupon-apply", "Apply"); apply.type = "submit";
      couponRow.append(couponLabel, couponInput, apply);
      var message = element("p", "sf-course-player__pay-message"); message.setAttribute("role", "status"); message.setAttribute("aria-live", "polite");
      var pay = element("button", "sf-course-player__complete-button sf-course-player__pay-button", "Loading price…"); pay.type = "button"; pay.disabled = true;
      var testNote = element("p", "sf-course-player__test-note");
      body.append(summary, couponRow, message, pay, testNote);

      function say(text, kind) { setText(message, text); message.className = "sf-course-player__pay-message" + (kind ? " is-" + kind : ""); }
      function busy(on) { couponInput.disabled = on; apply.disabled = on; pay.disabled = on || !quoteData; }
      function row(label, text, className) {
        var line = element("div", "sf-course-player__price-row" + (className ? " " + className : ""));
        line.append(element("dt", "", label), element("dd", "", text)); summary.appendChild(line);
      }
      function drawQuote() {
        summary.replaceChildren();
        row(quoteData.courseName || "Career Ascent", money(quoteData.price, quoteData.currency));
        if (Number(quoteData.discount) > 0) row("Coupon " + couponApplied, "−" + money(quoteData.discount, quoteData.currency), "is-discount");
        row("Total today", money(quoteData.total, quoteData.currency), "is-total");
        var free = Number(quoteData.total) <= 0;
        setText(pay, free ? "Enroll for free" : "Pay " + money(quoteData.total, quoteData.currency) + " with PayPal");
        setText(testNote, quoteData.testMode ? "Test environment: PayPal sandbox only, no real money moves." : "");
        pay.disabled = false;
      }
      function quote(code) {
        busy(true); say(code ? "Checking coupon…" : "");
        return payments("checkout", { courseId: guid(cfg.courseId), contactId: guid(cfg.contactId), couponCode: code || "", quoteOnly: true })
          .then(function (data) {
            quoteData = data; couponApplied = data.couponApplied ? (code || "").toUpperCase() : "";
            drawQuote();
            if (code) say(data.couponApplied ? "Coupon applied." : "That coupon does not apply.", data.couponApplied ? "ok" : "error");
          }).catch(function (error) {
            if (!quoteData) { setText(pay, "Pay with PayPal"); pay.disabled = true; }
            say(error.message || "We could not check that coupon.", "error");
          }).then(function () { busy(false); });
      }
      couponRow.addEventListener("submit", function (event) {
        event.preventDefault();
        var code = couponInput.value.trim();
        if (!code) { couponApplied = ""; quote(""); return; }
        quote(code);
      });
      pay.addEventListener("click", function () {
        busy(true); say("Starting checkout…");
        payments("checkout", {
          courseId: guid(cfg.courseId), contactId: guid(cfg.contactId), couponCode: couponApplied,
          returnUrl: pageUrlWith("success"), cancelUrl: pageUrlWith("cancel")
        }).then(function (data) {
          if (data.status === "enrolled") {
            return refreshEnrollment().then(function () { drawNavigation(); drawContent(); drawPaid(body, title, dismiss); });
          }
          if (data.status === "redirect" && isPayPalUrl(data.approvalUrl)) {
            say("Taking you to PayPal…"); window.location.assign(data.approvalUrl); return;
          }
          throw new Error("Checkout did not return a PayPal approval link.");
        }).catch(function (error) { busy(false); say(error.message || "Checkout failed. You were not charged.", "error"); });
      });
      quote("");
    }

    function drawPaid(body, title, dismiss) {
      setText(title, "You're in");
      body.replaceChildren();
      body.appendChild(element("p", "", "Your enrollment is active. Every section of the course is now unlocked, and your access does not expire."));
      var go = element("button", "sf-course-player__complete-button", "Start learning"); go.type = "button";
      go.addEventListener("click", dismiss); body.appendChild(go);
    }

    // Returning from PayPal: the webhook creates the enrollment, so confirm by polling for it.
    function handlePaymentReturn() {
      var url = new URL(window.location.href);
      var flag = url.searchParams.get("sf_payment");
      var orderId = url.searchParams.get("token") || "";
      if (!flag) return;
      window.history.replaceState(null, "", pageUrlWith(null));
      var overlay = element("div", "sf-course-player__modal-backdrop");
      var dialog = element("section", "sf-course-player__modal sf-course-player__subscription-modal");
      dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-label", "Payment status");
      var close = element("button", "sf-course-player__modal-close", "Close"); close.type = "button";
      var title = element("h2", "sf-course-player__modal-title", "Confirming your payment");
      var body = element("div", "sf-course-player__modal-body"); body.setAttribute("aria-live", "polite");
      function dismiss() { stopped = true; overlay.remove(); }
      var stopped = false;
      close.addEventListener("click", dismiss);
      dialog.append(close, title, body); overlay.appendChild(dialog); document.body.appendChild(overlay); close.focus();
      if (flag === "cancel") {
        setText(title, "Checkout canceled");
        body.appendChild(element("p", "", "You were not charged. You can subscribe any time from a locked section."));
        return;
      }
      body.appendChild(element("p", "", "Thanks. We're waiting for PayPal to confirm. This usually takes a few seconds."));
      var attempts = 0;
      function finish(heading, text) { setText(title, heading); body.replaceChildren(element("p", "", text)); }
      // Ask PayPal (through the payments service) how this order ended, so a declined or
      // held payment gets a straight answer instead of a spinner.
      function paymentState() {
        if (!orderId || !cfg.paymentsUrl) return Promise.resolve("waiting");
        return payments("checkout/status", { orderId: orderId, contactId: guid(cfg.contactId) })
          .then(function (data) { return data.state || "waiting"; }).catch(function () { return "waiting"; });
      }
      (function poll() {
        if (stopped) return;
        refreshEnrollment().then(function (enrollment) {
          if (stopped) return;
          if (enrollment) { drawNavigation(); drawContent(); drawPaid(body, title, dismiss); return; }
          return paymentState().then(function (state) {
            if (stopped) return;
            if (state === "declined") { finish("Payment not completed", "PayPal declined this payment, so you were not charged and you are not enrolled. Close this window and try again, or use a different payment method."); return; }
            if (state === "pending") { finish("Payment on hold", "PayPal is holding this payment for review. You have not been enrolled yet. Access unlocks automatically once PayPal releases it, usually within a day. You do not need to pay again."); return; }
            if (++attempts >= 20) { finish("Still processing", "We haven't seen your enrollment yet. If PayPal charged you, access appears within a few minutes. Refresh this page to check, or contact us and we'll sort it out."); return; }
            window.setTimeout(poll, 3000);
          });
        }).catch(function () { if (!stopped && ++attempts < 20) window.setTimeout(poll, 3000); });
      })();
    }

    function openActivity(activity) {
      var overlay = element("div", "sf-course-player__modal-backdrop");
      var dialog = element("section", "sf-course-player__modal");
      dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-label", activity.name);
      var close = element("button", "sf-course-player__modal-close", "Close"); close.type = "button";
      function dismiss() { overlay.remove(); }
      close.addEventListener("click", dismiss);
      overlay.addEventListener("click", function (event) { if (event.target === overlay) dismiss(); });
      var title = element("h2", "sf-course-player__modal-title", activity.name);
      var body = element("div", "sf-course-player__modal-body");
      dialog.append(close, title, body); overlay.appendChild(dialog); document.body.appendChild(overlay); close.focus();
      function drawModal() {
        body.replaceChildren();
        var resource = safeUrl(activity.url);
        var description = element("div", "sf-course-player__body");
        if (cfg.allowRichContent) description.innerHTML = activity.content; else setText(description, activity.content);
        body.appendChild(description);
        if (resource) {
          var link = element("a", "sf-course-player__resource", "Open activity resource");
          link.href = resource; link.target = "_blank"; link.rel = "noopener noreferrer";
          body.appendChild(link);
        }
        var actions = element("div", "sf-course-player__actions");
        if (isComplete(activity)) {
          actions.appendChild(element("span", "sf-course-player__complete", "Completed"));
          var ends = expiresOn(progressFor(activity.id));
          if (ends) actions.appendChild(element("span", "sf-course-player__expiry", "Valid until " + ends.toLocaleDateString()));
          if (cfg.allowProgressWrite) {
            var undo = element("button", "sf-course-player__next", "Mark incomplete"); undo.type = "button";
            undo.addEventListener("click", function () { clearCompletion(activity, undo, function () { drawModal(); drawContent(); drawNavigation(); drawOverall(); }); });
            actions.appendChild(undo);
          }
        } else if (cfg.allowProgressWrite) {
          if (isExpired(activity)) actions.appendChild(element("p", "sf-course-player__expiry", "Your completion expired on " + expiresOn(progressFor(activity.id)).toLocaleDateString() + ". Mark it complete again to renew."));
          var complete = element("button", "sf-course-player__complete-button", isExpired(activity) ? "Renew completion" : "Mark complete");
          complete.type = "button";
          complete.addEventListener("click", function () { saveCompletion(activity, complete, function () { drawModal(); drawContent(); drawNavigation(); drawOverall(); }); });
          actions.appendChild(complete);
        }
        if (actions.childNodes.length) body.appendChild(actions);
      }
      drawModal();
    }

    function responseError(response, action) {
      return response.text().then(function (text) {
        var detail = "";
        try {
          var data = JSON.parse(text);
          detail = data && data.error && data.error.message ? ": " + data.error.message : "";
        } catch (_) { detail = text ? ": " + text.slice(0, 300) : ""; }
        throw new Error(action + " (" + response.status + ")" + detail);
      });
    }

    function recordIdFromResponse(response) {
      var raw = response.headers.get("entityid") || response.headers.get("OData-EntityId") || response.headers.get("location") || "";
      var match = String(raw).match(/\(([0-9a-f-]{36})\)/i) || String(raw).match(/([0-9a-f-]{36})/i);
      return match ? guid(match[1]) : "";
    }

    // A previous POST can have succeeded even when the browser did not receive its response.
    // Locate that unlinked, Contact-owned record before issuing another POST on a retry.
    function findProgressStub(activity) {
      var fields = "suj_onlinecourseactivityprogressid,suj_name,_suj_completedby_value,_suj_online_course_activity_value";
      var filter = "suj_name eq " + odataString(activity.name + " progress") +
        " and _suj_completedby_value eq " + guid(cfg.contactId);
      return readAll(api(entity.progress + "?$select=" + fields + "&$filter=" + query(filter)))
        .then(function (rows) {
          var stub = rows.find(function (row) { return !value(row, "_suj_online_course_activity_value"); });
          return stub ? guid(value(stub, "suj_onlinecourseactivityprogressid")) : "";
        });
    }

    function createProgressStub(activity) {
      var stub = {
        suj_name: activity.name + " progress",
        "suj_CompletedBy@odata.bind": "/contacts(" + guid(cfg.contactId) + ")"
      };
      return request(api(entity.progress), { method: "POST", body: JSON.stringify(stub) }).then(function (response) {
        if (!response.ok) return responseError(response, "Could not create the progress record");
        var id = recordIdFromResponse(response);
        // Power Pages normally returns entityid. The lookup makes a missing header recoverable.
        return id ? id : findProgressStub(activity);
      }).then(function (id) {
        if (!id) throw new Error("The progress record was created, but its ID was not returned. Retry Mark complete; the player will look for the existing record before creating another.");
        console.info("Sujeeth course player: progress stub created", { activityId: activity.id, progressId: id });
        return id;
      });
    }

    function updateProgressCompletion(progressId, activity, completedOn) {
      var update = {
        suj_completed_on: completedOn,
        "suj_online_course_activity@odata.bind": "/" + entity.activities + "(" + activity.id + ")"
      };
      if (state.enrollment) {
        var enrollmentId = guid(value(state.enrollment, "suj_onlinecourseenrollmentid"));
        update["suj_online_course_enrollment@odata.bind"] = "/" + entity.enrollments + "(" + enrollmentId + ")";
      }
      return request(api(entity.progress + "(" + progressId + ")"), { method: "PATCH", body: JSON.stringify(update) }).then(function (response) {
        if (!response.ok) return responseError(response, "Could not link the progress record to this activity");
        console.info("Sujeeth course player: progress completion linked", { activityId: activity.id, progressId: progressId });
      });
    }

    function saveCompletion(activity, button, afterSave) {
      var label = button.textContent, now = new Date().toISOString();
      var existing = progressFor(activity.id), progressId = state.pendingProgress[activity.id] || "";
      button.disabled = true; setText(button, "Saving…");
      var saving;
      if (existing && existing.id) {
        saving = request(api(entity.progress + "(" + existing.id + ")"), { method: "PATCH", body: JSON.stringify({ suj_completed_on: now }) }).then(function (response) {
          if (!response.ok) return responseError(response, "Could not save completion");
          existing.completedOn = now;
        });
      } else {
        saving = (progressId ? Promise.resolve(progressId) : findProgressStub(activity).then(function (id) { return id || createProgressStub(activity); }))
          .then(function (id) {
            progressId = id; state.pendingProgress[activity.id] = id;
            return updateProgressCompletion(id, activity, now);
          }).then(function () {
            delete state.pendingProgress[activity.id];
            state.progress.push({ id: progressId, activityId: activity.id, completedOn: now });
          });
      }
      saving.then(function () {
        if (typeof afterSave === "function") afterSave(); else { drawOverall(); drawNavigation(); drawContent(); }
      }).catch(function (error) {
        button.disabled = false; setText(button, progressId ? "Retry save" : label);
        console.error("Sujeeth course player: completion save failed", { activityId: activity.id, progressId: progressId || null, error: error });
        window.alert(error.message + (progressId ? " The progress record was created; retrying will update that same record." : "") + " Check the table permissions and Web API columns for Online Course Activity Progress.");
      });
    }

    // Unmarking clears the completion date on the learner's existing progress row
    // (the row stays), so it only needs Write permission.
    function clearCompletion(activity, button, afterSave) {
      var existing = progressFor(activity.id);
      if (!existing || !existing.id) { if (typeof afterSave === "function") afterSave(); return; }
      var label = button.textContent;
      button.disabled = true; setText(button, "Saving…");
      request(api(entity.progress + "(" + existing.id + ")"), { method: "PATCH", body: JSON.stringify({ suj_completed_on: null }) }).then(function (response) {
        if (!response.ok) throw new Error("Could not unmark this activity (" + response.status + ").");
        existing.completedOn = "";
        if (typeof afterSave === "function") afterSave(); else { drawOverall(); drawNavigation(); drawContent(); }
      }).catch(function (error) {
        button.disabled = false; setText(button, label);
        window.alert(error.message + " Check the table permissions and Web API columns for Online Course Activity Progress.");
      });
    }

    var firstAvailable = state.sections.find(function (section) { return !sectionLocked(section); });
    state.activeSectionId = firstAvailable ? firstAvailable.id : null;
    drawOverall(); drawContent(); drawNavigation();
    handlePaymentReturn();
  }

  function start() {
    if (!cfg.courseId) { console.error("Sujeeth course player: data-course-id is required."); return; }
    var target = document.querySelector("[data-sf-course-player]") || document.createElement("div");
    if (!target.parentNode) document.body.appendChild(target);
    target.className = "sf-course-player sf-course-player--loading";
    target.textContent = "Loading course…";
    load().then(function () { render(target); }).catch(function (error) {
      target.className = "sf-course-player sf-course-player--error";
      target.textContent = "We could not load this course. " + error.message;
      console.error("Sujeeth course player", error);
    });
  }

  function init() {
    var link = document.createElement("link"); link.rel = "stylesheet"; link.href = cssUrl; document.head.appendChild(link); start();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();



