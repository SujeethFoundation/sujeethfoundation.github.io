# Course player assets

Load the player from a Power Pages course page:

```html
<script defer src="https://www.sujeeth.org/js/sujeeth-course-player.js"
  data-course-id="ONLINE-COURSE-GUID"
  data-contact-id="{{ user.id }}"
  data-progress-write="true"></script>
```

Add an optional `<div data-sf-course-player></div>` where the player should render. Without it, the player is appended to the page body.

## Required Power Pages configuration

The signed-in learner needs table permissions for the course tables. Enable the portal Web API and expose the selected columns through a public system view named **Power Pages Web API Columns** for each table.

| Table | Required columns |
| --- | --- |
| Online Course Section | ID, name, display order, description, video URL, online course |
| Online Course Activity | ID, name, display order, content, external URL, stage, passing score percent, quiz key, prerequisite activity, online course section |
| Online Course Enrollment | ID, online course, access status, completed on |
| Online Course Activity Progress | ID, online course enrollment, online course activity, completed on, score percent, name |

For a course page hosted outside Power Pages, set `data-api-root` to that Power Pages site's `/_api` URL only if that site is configured to permit the request. The normal installation runs inside the Power Pages page and uses its same-origin API automatically.

## Optional attributes

- `data-progress-write="true"` enables the **Mark complete** control. It remains read-only by default. A signed-in portal contact must also be supplied through `data-contact-id`; use `{{ user.id }}` in Power Pages HTML.
- `data-course-name="…"` overrides the course name fetched from Dataverse. It is optional.
- `data-rich-content="true"` renders staff-authored activity content as HTML. Leave it off for plain-text rendering.
- `data-css-url="https://…"` uses a different stylesheet.

The script loads `https://www.sujeeth.org/css/powerpages/sujeeth-foundation-course-player.css` by default. Add `https://www.sujeeth.org` to the Power Pages CSP `script-src` directive before embedding the script.

