### Coming Soon/Notify Me Widget

This JavaScript widget allows users to register their interest in a product that is either "coming soon" or "out of stock" (aka "notify me"). Depending on the `data-type` attribute provided, the widget will display appropriate messages and functionality.

#### Features:
- Dynamically display a form to collect user information (mobile, first name, last name).
- Adjust form and button text based on the widget type (`notify-me` or `coming-soon`).
- Submit user data to a specified API endpoint with email or mobile as a path parameter and appropriate query parameters.
- An option for the user to subscribe to the database (opt-in)

### Installation

Add the following script to your HTML to include the widget:

```html
<script src="https://cdn.jsdelivr.net/npm/notify-me-wl/index.js"></script>
```

### Usage

Add a button to your HTML where you want the widget to appear. The button should have an `id` of `popup-open`, a `data-fields` attribute with the fields you want to include in the form (as a JSON string), and a `data-type` attribute to specify the widget type (`notify-me` or `coming-soon`).

```html
<div id="notification-widget"></div>
<button id="popup-open" data-fields='["mobile", "firstName", "lastName"]' data-type="notify-me">Open Popup</button>
```

### Configuration

- `data-fields`: A JSON array specifying the fields to include in the form. Possible values are `"mobile"`, `"firstName"`, and `"lastName"`.
- `data-type`: Specifies the type of the widget. Possible values are `"notify-me"` and `"coming-soon"`.

### Example

```html
<div id="notification-widget"></div>
<button id="popup-open" data-fields='["mobile"]' data-type="notify-me">Open Popup</button>

<script>
  // The script provided will be included here
</script>
```

### How It Works

1. **Initialization**: The script listens for the `DOMContentLoaded` event to initialize the widget.
2. **Styles Injection**: It injects necessary styles for the modal and form elements.
3. **Modal Creation**: Creates the modal structure and appends it to the `notification-widget` div.
4. **Dynamic Content**: Based on the `data-type`, it sets the appropriate messages and button text.
5. **Form Submission**: Collects form data and submits it to the API with the mandatory email field and other possible fields.

### API Request Example 

# For sandbox environment
``` 
https://api.au-sandbox.thewishlist.io/services/wsservice/api/wishlist/items/customerInterest
```
# For production environment
``` 
https://api.au-aws.thewishlist.io/services/wsservice/api/wishlist/items/customerInterest
```

Replace `ACCESS_TOKEN` with your actual access token to authenticate API requests.
Replace `TENANT_ID` with your actual tenant to authenticate API requests.
