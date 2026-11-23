# Course player assets

Load the player from a Power Pages course page:

```html
<script defer src="https://www.sujeeth.org/js/sujeeth-course-player.js"
  data-course-id="ONLINE-COURSE-GUID"
  data-contact-id="{{ user.id }}"
  data-progress-write="true"></script>
```

Add an optional `<div data-sf-course-player></div>` where the player should render. Without it, the player is appended to the page body.

The player centers the selected section's `Video URL`. Its navigation expands only the selected section, and activity buttons open a modal. An activity with a Quiz Key is treated as a quiz and embeds its External URL in the modal; other activities display their Content/Description there.

SharePoint-hosted section videos and quiz resources open in a new tab. This avoids SharePoint cross-site framing restrictions. Use an embeddable YouTube, Vimeo, or Clipchamp URL for in-page playback.

## Required Power Pages configuration

The signed-in learner needs table permissions for the course tables. Enable the Power Pages Web API and list the selected columns in each table's `Webapi/<table logical name>/fields` site setting. The player does not depend on Dataverse views.

| Table | Required columns |
| --- | --- |
| Online Course Section | ID, name, display order, description, video URL, online course |
| Online Course Activity | ID, name, display order, content, external URL, stage, passing score percent, quiz key, prerequisite activity, online course section |
| Online Course Enrollment | ID, online course, access status, completed on, learner |
| Online Course Activity Progress | ID, online course enrollment, online course activity, completed on, completed by, score percent, name |

For free courses, give **Online Course Activity Progress** Contact-scope permissions through the `Completed By` relationship. This lets a learner read and create only their own progress rows without an enrollment record.

For a course page hosted outside Power Pages, set `data-api-root` to that Power Pages site's `/_api` URL only if that site is configured to permit the request. The normal installation runs inside the Power Pages page and uses its same-origin API automatically.

## Optional attributes

- `data-progress-write="true"` enables the **Mark complete** control. It remains read-only by default. A signed-in portal contact must also be supplied through `data-contact-id`; use `{{ user.id }}` in Power Pages HTML.
- `data-require-enrollment="true"` requires an active enrollment before a learner can save progress. Omit it for free courses: progress is then attached directly to the signed-in contact and the activity.
- `data-course-name="…"` overrides the course name fetched from Dataverse. It is optional.
- `data-rich-content="true"` renders staff-authored activity content as HTML. Leave it off for plain-text rendering.
- `data-css-url="https://…"` uses a different stylesheet.

The script loads `https://www.sujeeth.org/css/powerpages/sujeeth-foundation-course-player.css` by default. Add `https://www.sujeeth.org` to the Power Pages CSP `script-src` directive before embedding the script.



### Section subscription access

Use the **Subscription Access** choice on **Online Course Section** to control entry to a section:

- **Public** — any visitor may open the section.
- **Subscription only** — a visitor without an active course enrollment sees the subscription prompt instead.

Add `suj_subscription_access` to the Power Pages Web API fields for `suj_onlinecoursesection`. To give the prompt a destination, add `data-subscribe-url` to the player script tag.

The player uses the visitor's active **Online Course Enrollment** only for this section-entry check. A course can remain free and still save activity progress without requiring an enrollment.
