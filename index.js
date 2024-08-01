// Access token for the API
const ACCESS_TOKEN = "Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJSUUpQaHRWNmFrSWNXU3ZGekpKMl8yc1NJNkhWLTBEVmExX1F2NWVERzQ4In0.eyJleHAiOjE3MjI1MTkwNjEsImlhdCI6MTcyMjUxNzg2MSwianRpIjoiYzk5NjlkNDQtODY0OC00YjE2LWJjYTktNGVkOTdjMTQyZTVlIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmF1LXNhbmRib3gudGhld2lzaGxpc3QuaW8vYXV0aC9yZWFsbXMvdHdjTWFpbiIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiJmMzQxZmI5ZS01Y2U2LTRkZjgtYjY1ZC0yNTFjZjgyOTUwNzMiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJ0d2MtcG9zLWNsaWVudCIsInNlc3Npb25fc3RhdGUiOiIwOGYzNTBjZS00YjBhLTRiOTctOGM4Yi05Njg2Zjc1YzllMTYiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbImh0dHBzOi8vbG9jYWxob3N0Il0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJ0d2MtcG9zLXVzZXIiLCJvZmZsaW5lX2FjY2VzcyIsInR3Yy1zdG9yZS1vd25lciIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJzdG9yZSBlbWFpbCBwcm9maWxlIHRlbmFudGlkIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInRlbmFudGlkIjoidHdjZmFzaGlvbnN0YWdpbmciLCJuYW1lIjoiTWF0dCBIYW1wc2hpcmUiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJtYXR0QHRoZXdpc2hsaXN0LmlvIiwic3RvcmUiOiI5MjQ4ODMzNTY3NiIsImdpdmVuX25hbWUiOiJNYXR0IiwiZmFtaWx5X25hbWUiOiJIYW1wc2hpcmUiLCJlbWFpbCI6Im1hdHRAdGhld2lzaGxpc3QuaW8ifQ.WbYwyMMFb8BAAPcpUigfUlymtJbAEmQnQCSxy1iUGEVmJe116zL19grxNb-1C7lWhHappiMy69UuLzMEDaqBY4q-Kzo1xTAjIduEUTryMf7GUQMP9YnfWp5ZS1lFCtJPz7UkJaJTHuryVCh34rnkkBnV9KhoITW8GMaheQ5Sp42vY947x-GjOM7uvepxFxykNwR4O1YInwMEvCVmoEUA-T-nQZ7KaLohdCPhLw2kMyIouNPQHoG8ancDWCLFJN0CegFyI7trCjYgjq6h4JxfQiAXGSTJ-DhQrMve3deRZK_ivyEcwy5uWsCOPmsgU_ipheL-ve7h34RkKS0O9Xc1tQ"; // Replace `ACCESS_TOKEN` with your actual access token to authenticate API requests.
const TENANT_ID = "twcfashionstaging"; // Replace `TENANT_ID` with your actual tenant ID.

document.addEventListener("DOMContentLoaded", function () {
   const wrapper = document.getElementById("notification-widget");
   if (!wrapper) return;

   // Define and apply styles for the popup and button
   const styles = `
        .notification-btn {
            background-color: #fff;
            border: 1px solid black;
            color: black;
            padding: 12px 24px;
            text-align: center;
            width: 100%;
            cursor: pointer;
            text-transform: uppercase;
        }
        #popup-body.overlay {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0, 0, 0, 0.7);
            transition: opacity 200ms;
            visibility: hidden;
            opacity: 0;
        }
        #popup-wrapper {
            margin: 70px auto;
            padding: 15px;
            background: #fff;
            border-radius: 5px;
            max-width: 360px;
            position: relative;
        }
        #popup-close {
            position: absolute;
            top: 5px;
            right: 15px;
            transition: all 200ms;
            font-size: 30px;
            font-weight: bold;
            text-decoration: none;
            color: #333;
            cursor: pointer;
        }
        #popup-close:hover {
            color: #d80606;
        }
        #popup-title {
            margin: 0;
            font-size: 20px;
            max-width: 350px;
            text-transform: uppercase;
        }
        #popup-text {
            margin: 10px 0;
            font-size: 14px;
        }
        #popup-form {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        #popup-form input {
            padding: 0.475em 1em;
            border: 1px solid #caced1;
            border-radius: 0.25rem;
            font-size: 1.15rem;
            max-width: 100%;
        }
        #popup-form input::placeholder {
            font-size: 1rem;
        }
        #popup-form button {
            font-size: 0.85rem;
            padding: 0.975em 1em;
            font-weight: 600;
            border: none;
            text-transform: uppercase;
            background: #aca475;
            color: #fff;
            cursor: pointer;
        }
        .custom-select {
            position: relative;
        }
        .custom-select select {
            appearance: none;
            width: 100%;
            font-size: 1.15rem;
            padding: 0.475em 1em;
            background-color: #fff;
            border: 1px solid #caced1;
            border-radius: 0.25rem;
            color: #000;
            cursor: pointer;
        }
        .custom-select::before,
        .custom-select::after {
            --size: 0.3rem;
            content: "";
            position: absolute;
            right: 1rem;
            pointer-events: none;
        }
        .custom-select::before {
            border-left: var(--size) solid transparent;
            border-right: var(--size) solid transparent;
            border-bottom: var(--size) solid black;
            top: 40%;
        }
        .custom-select::after {
            border-left: var(--size) solid transparent;
            border-right: var(--size) solid transparent;
            border-top: var(--size) solid black;
            top: 55%;
        }
    `;

   const styleSheet = document.createElement("style");
   styleSheet.type = "text/css";
   styleSheet.innerText = styles;
   document.head.appendChild(styleSheet);

   // Create and append the overlay for the popup
   const overlay = document.createElement("div");
   overlay.innerHTML = `
        <div id="popup-body" class="overlay">
            <div id="popup-wrapper">
                <h3 id="popup-title"></h3>
                <span id="popup-close">&times;</span>
                <div id="popup-text"></div>
                <form id="popup-form">
                    <div class="custom-select">
                        <select name="select-size" required>
                        </select>
                    </div>
                    <input name="email" placeholder="Email" type="email" required />
                </form>
            </div>
        </div>
    `;

   wrapper.appendChild(overlay);

   const popupBody = document.getElementById("popup-body");
   const popupClose = document.getElementById("popup-close");
   const popupOpenButton = document.getElementById("popup-open");
   const popupTitle = document.getElementById("popup-title");
   const popupText = document.getElementById("popup-text");
   const sizeSelect = document.querySelector("select[name='select-size']");
   const form = overlay.querySelector("#popup-form");

   if (!popupBody || !popupClose || !popupOpenButton || !popupTitle || !sizeSelect) return;

   // Parse fields and type to be included in the form from data attribute
   const fields = JSON.parse(popupOpenButton.getAttribute("data-fields") || '["email"]');
   const type = popupOpenButton.getAttribute("data-type") || "notify-me";
   const typeConfig = {
      "notify-me": {
         text: "Register to receive a notification as soon as this item is back in stock",
         buttonText: "Notify me",
      },
      "coming-soon": {
         text: "Register your interest to hear more about this item",
         buttonText: "Register Interest",
      },
   };

   // Get product data from Shopify's global variable
   const productData = window.Shopify?.product || {
      id: "6786188247105",
      title: "THE ATG SCULPT FLARES TALL",
      product_option_value: {
         name: "BUTTER BLACK",
      },
      variants: [
         { id: 1, title: "S" },
         { id: "46906570899772", title: "M" },
         { id: 3, title: "L" },
         { id: 4, title: "XL" },
      ],
   };

   // Set the popup title and populate the size dropdown
   popupTitle.innerHTML = productData.title + "<br/>" + productData.product_option_value.name;
   productData.variants.forEach((variant) => {
      const option = document.createElement("option");
      option.value = variant.title;
      option.textContent = variant.title;
      sizeSelect.appendChild(option);
   });

   // Map for form fields
   popupText.innerText = typeConfig[type].text;

   const fieldMap = {
      email: `<input name="email" placeholder="Email" type="email" required />`,
      mobile: `<input name="mobile" placeholder="Mobile" type="tel" />`,
      firstName: `<input name="firstName" placeholder="First name" type="text" />`,
      lastName: `<input name="lastName" placeholder="Last name" type="text" />`,
   };

   // Add fields to the form based on the parsed fields
   fields.forEach((field) => {
      if (fieldMap[field]) {
         form.insertAdjacentHTML("beforeend", fieldMap[field]);
      }
   });

   form.insertAdjacentHTML("beforeend", `<div id="checkbox-wrapper"></div>`);
   const checkboxWrapper = document.getElementById("checkbox-wrapper");
   checkboxWrapper.insertAdjacentHTML("beforeend", `<input type="checkbox" name="mailList" id="mailList" />`);
   checkboxWrapper.insertAdjacentHTML("beforeend", `<label for="mailList">Subscribe to our mailing list</label>`);
   form.insertAdjacentHTML("beforeend", `<button type="submit">${typeConfig[type].buttonText}</button>`);

   // Show/hide the popup
   function showPopup() {
      popupBody.style.visibility = "visible";
      popupBody.style.opacity = 1;
   }

   function hidePopup() {
      popupBody.style.visibility = "hidden";
      popupBody.style.opacity = 0;
   }

   popupOpenButton.addEventListener("click", showPopup);
   popupClose.addEventListener("click", hidePopup);

   // Form submission handler
   if (form) {
      form.addEventListener("submit", function (event) {
         event.preventDefault();

         const selectedSize = sizeSelect.value;
         const selectedVariant = productData.variants.find((variant) => variant.title === selectedSize);

         if (selectedVariant) {
            const formData = {
               variantRef: selectedVariant.id,
               email: form.querySelector("input[name='email']").value,
               subscribe: form.querySelector("input[name='mailList']").checked,
            };

            if (type === "coming-soon") {
               formData.comingSoon = true;
               // formData.productRef = productData.id;
            } else {
               formData.notifyMe = true;
            }
            if (fields.includes("firstName")) {
               formData.firstName = form.querySelector("input[name='firstName']").value;
            }
            if (fields.includes("lastName")) {
               formData.lastName = form.querySelector("input[name='lastName']").value;
            }
            if (fields.includes("mobile")) {
               formData.mobile = form.querySelector("input[name='mobile']").value;
               // formData.phone = form.querySelector("input[name='mobile']").value;
            }

            let url = `https://api.au-aws.thewishlist.io/services/wsservice/api/wishlist/items/customerInterest`;

            fetch(url, {
               method: "POST",
               headers: {
                  "Content-Type": "application/json",
                  Authorization: ACCESS_TOKEN,
                  "X-Twc-Tenant": TENANT_ID,
               },
               body: JSON.stringify(formData),
            })
               .then((response) => {
                  if (response.ok) {
                     alert("Form submitted");
                     hidePopup();
                  } else {
                     alert("Form submission failed");
                  }
               })
               .catch((error) => {
                  console.error("Error submitting form:", error);
                  alert("Form submission failed");
               });
         } else {
            alert("Selected variant not found");
         }
      });
   }
});
