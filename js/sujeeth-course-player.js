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
    allowRichContent: script && script.getAttribute("data-rich-content") === "true"
  };

  var entity = {
    sections: "suj_onlinecoursesections",
    activities: "suj_onlinecourseactivities",
    enrollments: "suj_onlinecourseenrollments",
    progress: "suj_onlinecourseactivityprogresses"
  };
  var state = { course: null, sections: [], activities: [], progress: [], enrollment: null, activeId: null };

  function guid(value) { return String(value || "").replace(/[{}]/g, ""); }
  function query(value) { return encodeURIComponent(value); }
  function value(record, name) { return record && record[name] != null ? record[name] : ""; }
  function byOrder(a, b) { return Number(a.order || 0) - Number(b.order || 0) || String(a.name).localeCompare(String(b.name)); }
  function stageName(number) {
    return ({ 100000000: "Public", 100000001: "Onboarding", 100000002: "On demand", 100000003: "End survey" })[number] || "Activity";
  }
  function safeUrl(raw) {
    try {
      var url = new URL(raw, window.location.href);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch (_) { return null; }
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
    var courseUrl = api("suj_onlinecourses?$select=suj_onlinecourseid,suj_name,suj_description&$filter=" + query("suj_onlinecourseid eq " + guid(cfg.courseId)));
    var sectionUrl = api(entity.sections + "?$select=suj_onlinecoursesectionid,suj_name,suj_display_order,suj_description,suj_videourl&$filter=" + query(courseFilter) + "&$orderby=suj_display_order asc");
    var enrollmentUrl = api(entity.enrollments + "?$select=suj_onlinecourseenrollmentid,suj_access_status,suj_completed_on&$filter=" + query(courseFilter + " and suj_access_status eq 100000000"));
    var requests = [readAll(courseUrl), readAll(sectionUrl)];
    if (cfg.requireEnrollment) requests.push(readAll(enrollmentUrl));
    return Promise.all(requests).then(function (result) {
      state.course = result[0][0] || null;
      state.sections = result[1].map(function (row) {
        return { id: guid(value(row, "suj_onlinecoursesectionid")), name: value(row, "suj_name"), order: value(row, "suj_display_order"), description: value(row, "suj_description"), videoUrl: value(row, "suj_videourl") };
      }).sort(byOrder);
      state.enrollment = cfg.requireEnrollment ? (result[2][0] || null) : null;
      return Promise.all(state.sections.map(function (section) {
        var filter = "_suj_online_course_section_value eq " + section.id;
        var fields = "suj_onlinecourseactivityid,suj_name,suj_display_order,suj_content,suj_external_url,suj_stage,suj_passing_score_percent,suj_quiz_key,_suj_prerequisite_activity_value";
        return readAll(api(entity.activities + "?$select=" + fields + "&$filter=" + query(filter) + "&$orderby=suj_display_order asc"));
      }));
    }).then(function (activityGroups) {
      state.activities = activityGroups.reduce(function (all, rows, index) {
        return all.concat(rows.map(function (row) {
          return {
            id: guid(value(row, "suj_onlinecourseactivityid")), sectionId: state.sections[index].id,
            name: value(row, "suj_name"), order: value(row, "suj_display_order"),
            content: value(row, "suj_content"), url: value(row, "suj_external_url"),
            stage: value(row, "suj_stage"), scoreRequired: value(row, "suj_passing_score_percent"),
            quizKey: value(row, "suj_quiz_key"), prerequisiteId: guid(value(row, "_suj_prerequisite_activity_value"))
          };
        }));
      }, []);
      var fields = "suj_onlinecourseactivityprogressid,_suj_online_course_activity_value,suj_completed_on,suj_score_percent";
      var progressUrl = api(entity.progress + "?$select=" + fields);
      if (state.enrollment) {
        var enrollmentId = guid(value(state.enrollment, "suj_onlinecourseenrollmentid"));
        progressUrl += "&$filter=" + query("_suj_online_course_enrollment_value eq " + enrollmentId);
      }
      return readAll(progressUrl);
    }).then(function (progress) {
      state.progress = progress.map(function (row) {
        return { id: guid(value(row, "suj_onlinecourseactivityprogressid")), activityId: guid(value(row, "_suj_online_course_activity_value")), completedOn: value(row, "suj_completed_on"), score: value(row, "suj_score_percent") };
      });
    });
  }

  function progressFor(activityId) { return state.progress.find(function (item) { return item.activityId === activityId; }); }
  function isComplete(activity) { return Boolean(progressFor(activity.id) && progressFor(activity.id).completedOn); }
  function sectionActivities(sectionId) { return state.activities.filter(function (activity) { return activity.sectionId === sectionId; }).sort(byOrder); }
  function sectionCompletion(sectionId) {
    var activities = sectionActivities(sectionId);
    return { completed: activities.filter(isComplete).length, total: activities.length };
  }
  function overallCompletion() { return { completed: state.activities.filter(isComplete).length, total: state.activities.length }; }
  function activityById(id) { return state.activities.find(function (activity) { return activity.id === id; }); }

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
    }

    function drawNavigation() {
      navigation.replaceChildren();
      state.sections.forEach(function (section) {
        var group = element("section", "sf-course-player__section");
        var count = sectionCompletion(section.id);
        var label = element("h2", "sf-course-player__section-title", section.order + ". " + section.name);
        var status = element("span", "sf-course-player__section-status", count.completed + "/" + count.total);
        label.appendChild(status); group.appendChild(label);
        var list = element("ol", "sf-course-player__activity-list");
        sectionActivities(section.id).forEach(function (activity) {
          var item = element("li", "sf-course-player__activity-item");
          var button = element("button", "sf-course-player__activity-link" + (activity.id === state.activeId ? " is-active" : ""), activity.name);
          button.type = "button"; button.dataset.activityId = activity.id;
          button.setAttribute("aria-current", activity.id === state.activeId ? "step" : "false");
          if (isComplete(activity)) button.classList.add("is-complete");
          button.addEventListener("click", function () { state.activeId = activity.id; drawNavigation(); drawContent(); });
          item.appendChild(button); list.appendChild(item);
        });
        group.appendChild(list); navigation.appendChild(group);
      });
    }

    function drawContent() {
      content.replaceChildren();
      var activity = activityById(state.activeId) || state.activities[0];
      if (!activity) { content.appendChild(element("p", "sf-course-player__empty", "This course does not have any activities yet.")); return; }
      state.activeId = activity.id;
      var section = state.sections.find(function (item) { return item.id === activity.sectionId; });
      content.appendChild(element("p", "sf-course-player__eyebrow", (section ? section.name + " · " : "") + stageName(activity.stage)));
      content.appendChild(element("h2", "sf-course-player__activity-title", activity.name));
      if (activity.content) {
        var body = element("div", "sf-course-player__body");
        if (cfg.allowRichContent) body.innerHTML = activity.content; else setText(body, activity.content);
        content.appendChild(body);
      }
      var resource = safeUrl(activity.url);
      if (resource) {
        var link = element("a", "sf-course-player__resource", "Open activity resource");
        link.href = resource; link.target = "_blank"; link.rel = "noopener noreferrer"; content.appendChild(link);
      }
      if (activity.quizKey) content.appendChild(element("p", "sf-course-player__quiz", "Quiz: " + activity.quizKey + (activity.scoreRequired !== "" ? " · Passing score: " + activity.scoreRequired + "%" : "")));
      var actions = element("div", "sf-course-player__actions");
      var complete = isComplete(activity);
      if (complete) actions.appendChild(element("span", "sf-course-player__complete-label", "Completed"));
      else if (cfg.allowProgressWrite && cfg.contactId && (!cfg.requireEnrollment || state.enrollment)) {
        var completeButton = element("button", "sf-course-player__complete-button", "Mark complete"); completeButton.type = "button";
        completeButton.addEventListener("click", function () { saveCompletion(activity, completeButton); }); actions.appendChild(completeButton);
      } else if (cfg.requireEnrollment && !state.enrollment) actions.appendChild(element("p", "sf-course-player__notice", "Sign in with an active enrollment to save progress."));
      else if (!cfg.contactId) actions.appendChild(element("p", "sf-course-player__notice", "Your learner profile could not be identified, so progress cannot be saved."));
      var index = state.activities.findIndex(function (item) { return item.id === activity.id; });
      if (index >= 0 && state.activities[index + 1]) {
        var next = element("button", "sf-course-player__next", "Next activity"); next.type = "button";
        next.addEventListener("click", function () { state.activeId = state.activities[index + 1].id; drawNavigation(); drawContent(); }); actions.appendChild(next);
      }
      content.appendChild(actions);
    }

    function saveCompletion(activity, button) {
      button.disabled = true; setText(button, "Saving…");
      var body = {
        suj_name: activity.name + " progress",
        suj_completed_on: new Date().toISOString(),
        "suj_online_course_activity@odata.bind": "/" + entity.activities + "(" + activity.id + ")"
      };
      if (state.enrollment) {
        var enrollmentId = guid(value(state.enrollment, "suj_onlinecourseenrollmentid"));
        body["suj_online_course_enrollment@odata.bind"] = "/" + entity.enrollments + "(" + enrollmentId + ")";
      }
      body["suj_completedby@odata.bind"] = "/contacts(" + guid(cfg.contactId) + ")";
      request(api(entity.progress), { method: "POST", body: JSON.stringify(body) }).then(function (response) {
        if (!response.ok) throw new Error("Could not save completion (" + response.status + ").");
        return response.headers.get("entityid") || "";
      }).then(function (id) {
        state.progress.push({ id: guid(id), activityId: activity.id, completedOn: new Date().toISOString(), score: "" });
        drawOverall(); drawNavigation(); drawContent();
      }).catch(function (error) {
        button.disabled = false; setText(button, "Mark complete");
        window.alert(error.message + " Check the table permissions and Web API columns for Online Course Activity Progress.");
      });
    }

    drawOverall(); drawNavigation(); state.activeId = state.activeId || (state.activities[0] && state.activities[0].id); drawContent();
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

