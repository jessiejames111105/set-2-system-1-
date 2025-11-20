import { w as push, G as head, y as pop, I as ensure_array_like, J as store_get, K as attr_class, M as unsubscribe_stores, N as escape_html, O as attr, P as stringify } from './index-Dr4ytFAP.js';
import { t as toastStore, m as modalStore, s as studentDocReqModalStore, d as docReqModalStore } from './studentDocReqModalStore-CvIR74KN.js';

const favicon = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20height='48px'%20viewBox='0%20-960%20960%20960'%20width='48px'%20fill='%23789DE5'%3e%3cpath%20d='M222-255q63-40%20124.5-60.5T480-336q72%200%20134%2020.5T739-255q44-54%2062.5-109T820-480q0-145-97.5-242.5T480-820q-145%200-242.5%2097.5T140-480q0%2061%2019%20116t63%20109Zm257.81-195q-57.81%200-97.31-39.69-39.5-39.68-39.5-97.5%200-57.81%2039.69-97.31%2039.68-39.5%2097.5-39.5%2057.81%200%2097.31%2039.69%2039.5%2039.68%2039.5%2097.5%200%2057.81-39.69%2097.31-39.68%2039.5-97.5%2039.5Zm-.21%20370q-83.15%200-156.28-31.5t-127.22-86Q142-252%20111-324.84%2080-397.68%2080-480.5t31.5-155.66Q143-709%20197.5-763t127.34-85.5Q397.68-880%20480.5-880t155.66%2031.5Q709-817%20763-763t85.5%20127Q880-563%20880-480.27q0%2082.74-31.5%20155.5Q817-252%20763-197.5t-127.13%2086Q562.74-80%20479.6-80Z'/%3e%3c/svg%3e";
function Toast($$payload, $$props) {
  push();
  let { message = "", type = "success" } = $$props;
  let hiding = false;
  function getIcon(type2) {
    switch (type2) {
      case "success":
        return "check_circle";
      case "error":
        return "error";
      case "warning":
        return "warning";
      case "info":
        return "info";
      default:
        return "check_circle";
    }
  }
  {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div${attr_class(`toast toast-${stringify(type)}`, "svelte-1rmoiu", { "toast-visible": !hiding, "toast-hiding": hiding })}><div class="toast-content svelte-1rmoiu"><span class="material-symbols-outlined toast-icon svelte-1rmoiu">${escape_html(getIcon(type))}</span> <span class="toast-message svelte-1rmoiu">${escape_html(message)}</span> <button class="toast-close svelte-1rmoiu" aria-label="Close notification"><span class="material-symbols-outlined svelte-1rmoiu">close</span></button></div></div>`);
  }
  $$payload.out.push(`<!--]-->`);
  pop();
}
function ToastContainer($$payload, $$props) {
  push();
  let toasts = [];
  toastStore.subscribe((value) => {
    toasts = value;
  });
  const each_array = ensure_array_like(toasts);
  $$payload.out.push(`<div class="toast-container svelte-n5a2bz"><!--[-->`);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let toast = each_array[$$index];
    Toast($$payload, {
      message: toast.message,
      type: toast.type,
      duration: toast.duration
    });
  }
  $$payload.out.push(`<!--]--></div>`);
  pop();
}
function Modal($$payload, $$props) {
  push();
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]-->`);
  pop();
}
function AdminDocumentRequestModal($$payload, $$props) {
  push();
  let {
    request = {},
    requestStatuses = [],
    modalStatuses = []
  } = $$props;
  let selectedRequest = { ...request };
  let isModalStatusDropdownOpen = false;
  let newMessage = "";
  let isSendingMessage = false;
  let selectedFiles = [];
  let paymentStatus = "pending";
  let messages = selectedRequest.messages || [];
  let savedStatus = request.status || "";
  let savedPaymentStatus = request.paymentStatus || "pending";
  let isChatDisabled = savedStatus === "released" || savedStatus === "cancelled";
  function formatTentativeDateForDisplay(dateStr) {
    if (!dateStr) return "--/--/----";
    const [y, m, d] = dateStr.split("-");
    if (!y || !m || !d) return "--/--/----";
    return `${m}/${d}/${y}`;
  }
  let modalCurrentStatusName = selectedRequest ? (requestStatuses.find((s) => s.id === selectedRequest.status) || {}).name || "Select" : "Select";
  const each_array = ensure_array_like(
    // Watch for message changes and scroll to bottom (including automated messages)
    // Scroll to bottom whenever messages change
    // Start polling when component mounts
    // Poll every 8 seconds for new messages (reduced from 3s to reduce server load)
    // Listen for visibility changes to pause polling when tab is hidden
    // Scroll to bottom when messages change
    // Cleanup on unmount
    modalStatuses
  );
  $$payload.out.push(`<div class="docreq-modal-content svelte-zl658f"><div class="docreq-modal-grid svelte-zl658f"><div class="docreq-modal-left-container svelte-zl658f"><header class="docreq-modal-title svelte-zl658f"><div class="docreq-modal-title-row svelte-zl658f"><div><h2 class="svelte-zl658f">Request Details</h2> <div class="docreq-modal-sub svelte-zl658f">ID: <span>${escape_html(selectedRequest.requestId)}</span></div></div></div></header> <div class="docreq-cards svelte-zl658f"><div class="docreq-card svelte-zl658f"><div class="card-label svelte-zl658f"><span class="material-symbols-outlined">description</span> Document Type</div> <div class="admin-card-value svelte-zl658f">${escape_html(selectedRequest.documentType)}</div></div> <div class="docreq-card svelte-zl658f"><div class="card-label svelte-zl658f"><span class="material-symbols-outlined">account_circle</span> Processed By</div> <div class="admin-card-value svelte-zl658f">${escape_html(selectedRequest.processedBy ?? "—")}</div></div> <div class="docreq-card svelte-zl658f"><div class="card-label svelte-zl658f"><span class="material-symbols-outlined">info</span> Status</div> <div class="admin-card-value svelte-zl658f"><div${attr_class("docreq-status-dropdown svelte-zl658f", void 0, { "open": isModalStatusDropdownOpen })} aria-haspopup="listbox"${attr("aria-expanded", isModalStatusDropdownOpen)}><button class="docreq-status-dropdown-trigger svelte-zl658f" aria-label="Change status"${attr("disabled", request?.status === "cancelled" || request?.status === "rejected", true)}><span class="docreq-status-dropdown-label svelte-zl658f">${escape_html(modalCurrentStatusName)}</span> <span class="material-symbols-outlined docreq-status-dropdown-caret svelte-zl658f">${escape_html("expand_more")}</span></button> <div class="docreq-status-dropdown-menu svelte-zl658f" role="listbox" aria-label="Select status"><!--[-->`);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let st = each_array[$$index];
    $$payload.out.push(`<button type="button" class="docreq-status-item svelte-zl658f" role="option"${attr("aria-selected", selectedRequest.status === st.id)}><span${attr_class(`status-dot ${stringify(st.id)}`, "svelte-zl658f")}></span> <span class="status-text svelte-zl658f">${escape_html(st.name)}</span></button>`);
  }
  $$payload.out.push(`<!--]--></div></div></div></div> `);
  if (["verifying", "processing"].includes(selectedRequest.status) || selectedRequest.tentativeDate) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="docreq-card svelte-zl658f"><div class="card-label svelte-zl658f"><span class="material-symbols-outlined">event</span> Tentative Date</div> <div class="admin-card-value svelte-zl658f">`);
    if (["verifying", "processing"].includes(selectedRequest.status)) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<input type="date" class="date-input editable svelte-zl658f"${attr("value", selectedRequest.tentativeDate || "")}/>`);
    } else {
      $$payload.out.push("<!--[!-->");
      $$payload.out.push(`<div class="date-box readonly svelte-zl658f">${escape_html(formatTentativeDateForDisplay(selectedRequest.tentativeDate))}</div>`);
    }
    $$payload.out.push(`<!--]--></div></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <div class="docreq-card svelte-zl658f"><div class="card-label svelte-zl658f"><span class="material-symbols-outlined">payments</span> Payment Amount</div> <div class="admin-card-value svelte-zl658f"><div class="payment-display-container svelte-zl658f">`);
  {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<div${attr_class(`payment-readonly ${stringify(request?.status !== "cancelled" && request?.status !== "rejected" && selectedRequest.paymentAmount !== null && selectedRequest.paymentAmount !== void 0 ? paymentStatus : "")}`, "svelte-zl658f")}>`);
    if (selectedRequest.paymentAmount !== null && selectedRequest.paymentAmount !== void 0) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`₱${escape_html(selectedRequest.paymentAmount)}`);
    } else {
      $$payload.out.push("<!--[!-->");
      $$payload.out.push(`<span class="not-set svelte-zl658f">Not set</span>`);
    }
    $$payload.out.push(`<!--]--></div>`);
  }
  $$payload.out.push(`<!--]--> <div class="payment-actions svelte-zl658f"><button${attr_class(`payment-status-toggle ${stringify("paid")}`, "svelte-zl658f")}${attr("title", selectedRequest.paymentAmount === null || selectedRequest.paymentAmount === void 0 ? "Set payment amount first" : "Mark as paid")}${attr("aria-label", "Mark as paid")}${attr("disabled", savedStatus === "cancelled" || savedStatus === "rejected" || savedStatus === "released" || selectedRequest.paymentAmount === null || selectedRequest.paymentAmount === void 0, true)}><span class="material-symbols-outlined svelte-zl658f">${escape_html("check_circle")}</span></button> <button class="payment-edit-btn svelte-zl658f"${attr("title", "Edit payment amount")}${attr("aria-label", "Edit payment amount")}${attr("disabled", savedStatus === "cancelled" || savedStatus === "rejected" || savedStatus === "released" || savedPaymentStatus === "paid", true)}><span class="material-symbols-outlined svelte-zl658f">${escape_html("edit")}</span></button></div></div></div></div> `);
  if (selectedRequest.status === "cancelled" && selectedRequest.cancelledDate) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="docreq-card svelte-zl658f"><div class="card-label svelte-zl658f"><span class="material-symbols-outlined">event_busy</span> Cancelled Date</div> <div class="admin-card-value svelte-zl658f">${escape_html(selectedRequest.cancelledDate)}</div></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div> <div class="docreq-purpose svelte-zl658f"><div class="purpose-label svelte-zl658f"><span class="material-symbols-outlined">description</span> Purpose &amp; Details</div> <div class="purpose-content svelte-zl658f">${escape_html(selectedRequest.purpose ?? "No purpose provided")}</div></div> <div class="action-buttons svelte-zl658f"><button class="docreq-approve-button svelte-zl658f"${attr("disabled", request?.status === "cancelled" || request?.status === "rejected", true)}><span class="material-symbols-outlined svelte-zl658f">check_circle</span> Update Request</button> <button class="docreq-reject-button svelte-zl658f"${attr("disabled", savedStatus === "cancelled" || savedStatus === "rejected" || savedStatus === "released", true)}><span class="material-symbols-outlined svelte-zl658f">cancel</span> Reject Request</button> <button class="docreq-complete-button svelte-zl658f"><span class="material-symbols-outlined svelte-zl658f">arrow_back</span> Back</button></div></div> <div class="docreq-modal-right-container svelte-zl658f"><div class="student-info-section svelte-zl658f"><h3 class="svelte-zl658f"><span class="material-symbols-outlined">school</span> Student Information</h3> <div class="student-info-grid svelte-zl658f"><div class="student-field svelte-zl658f"><div class="field-label svelte-zl658f">Student ID</div> <div class="field-value svelte-zl658f">${escape_html(selectedRequest.studentId)}</div></div> <div class="student-field svelte-zl658f"><div class="field-label svelte-zl658f">Full Name</div> <div class="field-value svelte-zl658f">${escape_html(selectedRequest.studentName)}</div></div> <div class="student-field svelte-zl658f"><div class="field-label svelte-zl658f">Grade &amp; Section</div> <div class="field-value svelte-zl658f">${escape_html(selectedRequest.gradeLevel)} - ${escape_html(selectedRequest.section || "N/A")}</div></div> <div class="student-field svelte-zl658f"><div class="field-label svelte-zl658f">Date of birth</div> <div class="field-value svelte-zl658f">${escape_html(selectedRequest.dateOfBirth ?? "—")}</div></div></div></div> <div class="chat-container svelte-zl658f"><div class="chat-header svelte-zl658f"><h3 class="svelte-zl658f"><span class="material-symbols-outlined svelte-zl658f">forum</span> Communication</h3> <span class="chat-count-badge svelte-zl658f">${escape_html(messages.length)}</span></div> <div class="admin-chat-messages svelte-zl658f">`);
  if (messages.length > 0) {
    $$payload.out.push("<!--[-->");
    const each_array_1 = ensure_array_like(messages);
    $$payload.out.push(`<!--[-->`);
    for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
      let msg = each_array_1[$$index_2];
      $$payload.out.push(`<div${attr_class(`message-wrapper ${stringify(msg.authorRole === "admin" ? "sent" : "received")}`, "svelte-zl658f")}>`);
      if (msg.authorRole !== "admin") {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<div class="message-avatar svelte-zl658f"><span class="material-symbols-outlined svelte-zl658f">account_circle</span></div>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--> <div class="message-bubble svelte-zl658f"><div class="message-header svelte-zl658f"><span class="message-author svelte-zl658f">${escape_html(msg.author)}</span> <span class="message-time svelte-zl658f">${escape_html(new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</span></div> `);
      if (msg.text) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<div class="admin-document-request-message-text">${escape_html(msg.text)}</div>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--> `);
      if (msg.attachments && msg.attachments.length > 0) {
        $$payload.out.push("<!--[-->");
        const each_array_2 = ensure_array_like(msg.attachments);
        $$payload.out.push(`<div class="message-attachments svelte-zl658f"><!--[-->`);
        for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
          let attachment = each_array_2[$$index_1];
          $$payload.out.push(`<button class="attachment-item svelte-zl658f"><span class="material-symbols-outlined svelte-zl658f">attach_file</span> <div class="attachment-info svelte-zl658f"><span class="attachment-name svelte-zl658f">${escape_html(attachment.name)}</span> <span class="attachment-size svelte-zl658f">${escape_html((attachment.size / 1024).toFixed(1))} KB</span></div> <span class="material-symbols-outlined svelte-zl658f">download</span></button>`);
        }
        $$payload.out.push(`<!--]--></div>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--></div></div>`);
    }
    $$payload.out.push(`<!--]-->`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<div class="no-chat svelte-zl658f"><span class="material-symbols-outlined svelte-zl658f">chat_bubble_outline</span> <p class="svelte-zl658f">No messages yet</p> <p class="subtitle svelte-zl658f">Start a conversation with the student</p></div>`);
  }
  $$payload.out.push(`<!--]--></div> <div class="admin-chat-input-wrapper svelte-zl658f">`);
  if (selectedFiles.length > 0) {
    $$payload.out.push("<!--[-->");
    const each_array_3 = ensure_array_like(selectedFiles);
    $$payload.out.push(`<div class="selected-files-preview svelte-zl658f"><!--[-->`);
    for (let index = 0, $$length = each_array_3.length; index < $$length; index++) {
      let file = each_array_3[index];
      $$payload.out.push(`<div class="file-preview-item svelte-zl658f"><span class="material-symbols-outlined svelte-zl658f">description</span> <span class="file-preview-name svelte-zl658f">${escape_html(file.name)}</span> <span class="file-preview-size svelte-zl658f">(${escape_html((file.size / 1024).toFixed(1))} KB)</span> <button class="remove-file-btn svelte-zl658f" title="Remove file"><span class="material-symbols-outlined svelte-zl658f">close</span></button></div>`);
    }
    $$payload.out.push(`<!--]--></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <div${attr_class("admin-chat-input svelte-zl658f", void 0, { "disabled": isChatDisabled })}>`);
  if (isChatDisabled) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="chat-disabled-notice svelte-zl658f"><span class="material-symbols-outlined svelte-zl658f">block</span> <span>Chat is disabled for ${escape_html(savedStatus === "released" ? "released" : "cancelled")} requests</span></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" style="display: none;" class="svelte-zl658f"/> <button class="attach-btn svelte-zl658f" title="Attach file" aria-label="Attach file"><span class="material-symbols-outlined svelte-zl658f">attach_file</span></button> <input placeholder="Type your message..." aria-label="Message input"${attr("value", newMessage)}${attr("disabled", isSendingMessage, true)} class="svelte-zl658f"/> <button class="send-btn svelte-zl658f" title="Send message" aria-label="Send message"${attr("disabled", !newMessage.trim() && selectedFiles.length === 0, true)}><span class="material-symbols-outlined svelte-zl658f">send</span></button>`);
  }
  $$payload.out.push(`<!--]--></div></div></div></div></div></div> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]-->`);
  pop();
}
function ModalContainer($$payload, $$props) {
  push();
  let modals = [];
  modalStore.subscribe((value) => {
    modals = value;
  });
  const each_array = ensure_array_like(modals);
  $$payload.out.push(`<!--[-->`);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let modal = each_array[$$index];
    Modal($$payload, {
      title: modal.props.title || "",
      size: modal.options.size || "medium",
      closable: modal.options.closable !== false,
      backdrop: modal.options.backdrop !== false
    });
  }
  $$payload.out.push(`<!--]-->`);
  pop();
}
function AdminDocumentRequestModalContainer($$payload, $$props) {
  push();
  var $$store_subs;
  let modalState = store_get($$store_subs ??= {}, "$docReqModalStore", docReqModalStore);
  let visible = false;
  let closing = false;
  if (modalState.isOpen || visible || closing) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div${attr_class("docreq-modal-overlay svelte-1yi457b", void 0, {
      "docreq-modal-visible": visible,
      "docreq-modal-closing": closing
    })} role="dialog" aria-modal="true" tabindex="-1">`);
    AdminDocumentRequestModal($$payload, {
      request: modalState.request,
      requestStatuses: modalState.requestStatuses,
      modalStatuses: modalState.modalStatuses,
      onUpdate: modalState.onUpdate,
      onReject: modalState.onReject
    });
    $$payload.out.push(`<!----></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]-->`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
function StudentDocumentRequestModal($$payload, $$props) {
  push();
  let {
    request = {}
  } = $$props;
  let selectedRequest = { ...request };
  let newMessage = "";
  let isSendingMessage = false;
  let selectedFiles = [];
  let currentPage = 1;
  let messages = selectedRequest.messages || [];
  let isChatDisabled = selectedRequest.status === "released" || selectedRequest.status === "cancelled";
  function getStatusDisplayName(status) {
    const statusNames = {
      "on_hold": "On Hold",
      "verifying": "Verifying",
      "processing": "For Processing",
      "for_pickup": "For Pick Up",
      "released": "Released",
      "rejected": "Rejected",
      "cancelled": "Cancelled"
    };
    return statusNames[status] || status;
  }
  function formatDate(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
  $$payload.out.push(`<div class="student-docreq-modal-content svelte-10q3qfh"><div class="student-docreq-modal-grid svelte-10q3qfh"><div${attr_class("student-docreq-modal-left-container svelte-10q3qfh", void 0, {
    "mobile-hidden": (
      // Start polling when component mounts
      // Poll every 8 seconds for new messages (reduced from 3s to reduce server load)
      // Listen for visibility changes to pause polling when tab is hidden
      // Scroll to bottom when messages change
      // Cleanup on unmount
      currentPage !== 1
    )
  })}><header class="student-docreq-modal-title svelte-10q3qfh"><h2 class="svelte-10q3qfh">Request Details</h2> <div class="student-docreq-modal-sub svelte-10q3qfh">ID: <span>${escape_html(selectedRequest.requestId)}</span></div></header> <div class="student-docreq-cards svelte-10q3qfh"><div${attr_class(`student-docreq-card full-width status-card-horizontal status-card-${stringify(selectedRequest.status)}`, "svelte-10q3qfh")}><div class="status-group svelte-10q3qfh"><div class="card-label svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">info</span> Status:</div> <button${attr_class(`status-badge status-${stringify(selectedRequest.status)}`, "svelte-10q3qfh")} title="Click to view status history" aria-label="View status history timeline">${escape_html(getStatusDisplayName(selectedRequest.status))}</button></div> <button class="status-info-button svelte-10q3qfh" title="Click to view status flow information" aria-label="View status flow information"><span class="material-symbols-outlined svelte-10q3qfh">help</span></button></div> <div class="student-docreq-card half-width svelte-10q3qfh"><div class="card-label svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">description</span> Document Type</div> <div class="card-value svelte-10q3qfh">${escape_html(selectedRequest.type)}</div></div> <div class="student-docreq-card half-width svelte-10q3qfh"><div class="card-label svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">account_circle</span> Processed By</div> <div class="card-value svelte-10q3qfh">${escape_html(selectedRequest.processedBy ?? "—")}</div></div> `);
  if (selectedRequest.paymentAmount !== null && selectedRequest.paymentAmount !== void 0) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="student-docreq-card third-row svelte-10q3qfh"><div class="card-label svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">payments</span> Payment</div> <div class="card-value payment-value svelte-10q3qfh">`);
    if (selectedRequest.paymentAmount === 0) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<span class="payment-amount free svelte-10q3qfh">Free</span>`);
    } else {
      $$payload.out.push("<!--[!-->");
      if (selectedRequest.paymentStatus === "pending") {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<a href="javascript:void(0)" class="payment-amount pending clickable svelte-10q3qfh" title="Click to view payment instructions" aria-label="View payment instructions" role="button">₱${escape_html(selectedRequest.paymentAmount)} (Pending)</a>`);
      } else {
        $$payload.out.push("<!--[!-->");
        $$payload.out.push(`<span class="payment-amount paid svelte-10q3qfh">₱${escape_html(selectedRequest.paymentAmount)} (Paid)</span>`);
      }
      $$payload.out.push(`<!--]-->`);
    }
    $$payload.out.push(`<!--]--></div></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <div class="student-docreq-card third-row svelte-10q3qfh"><div class="card-label svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">calendar_today</span> Requested Date</div> <div class="card-value svelte-10q3qfh">${escape_html(selectedRequest.requestedDate ?? "—")}</div></div> `);
  if (selectedRequest.status === "cancelled" && selectedRequest.cancelledDate) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="student-docreq-card third-row svelte-10q3qfh"><div class="card-label svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">event_busy</span> Cancelled Date</div> <div class="card-value svelte-10q3qfh">${escape_html(selectedRequest.cancelledDate)}</div></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
    if (selectedRequest.tentativeDate) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<div class="student-docreq-card third-row svelte-10q3qfh"><div class="card-label svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">event</span> Tentative Date</div> <div class="card-value svelte-10q3qfh"><div class="date-display svelte-10q3qfh">${escape_html(formatDate(selectedRequest.tentativeDate))}</div></div></div>`);
    } else {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]-->`);
  }
  $$payload.out.push(`<!--]--> `);
  if (selectedRequest.status === "released" && selectedRequest.completedDate) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="student-docreq-card svelte-10q3qfh"><div class="card-label svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">check_circle</span> Released Date</div> <div class="card-value svelte-10q3qfh">${escape_html(selectedRequest.completedDate)}</div></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div> <div class="student-docreq-purpose svelte-10q3qfh"><div class="purpose-label svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">description</span> Purpose &amp; Details</div> <div class="purpose-content svelte-10q3qfh">${escape_html(selectedRequest.purpose || "No purpose provided")}</div></div> `);
  if (selectedRequest.adminNote) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="admin-note-section svelte-10q3qfh"><div class="note-label svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">note</span> Admin Note</div> <p class="note-text svelte-10q3qfh">${escape_html(selectedRequest.adminNote)}</p></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <div class="student-modal-action-buttons svelte-10q3qfh"><button class="student-cancel-button svelte-10q3qfh"${attr("disabled", selectedRequest.status !== "on_hold", true)}${attr("title", selectedRequest.status !== "on_hold" ? "Can only cancel requests that are on hold" : "Cancel this request")}><span class="material-symbols-outlined svelte-10q3qfh">cancel</span> Cancel Request</button> <button class="student-back-button svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">arrow_back</span> Back</button></div></div> <div${attr_class("student-docreq-modal-right-container svelte-10q3qfh", void 0, { "mobile-hidden": currentPage !== 2 })}><div class="chat-container svelte-10q3qfh"><div class="chat-header svelte-10q3qfh"><h3 class="svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">forum</span> Communication</h3> <span class="chat-count-badge svelte-10q3qfh">${escape_html(messages.length)}</span></div> <div class="student-chat-messages svelte-10q3qfh">`);
  if (messages.length > 0) {
    $$payload.out.push("<!--[-->");
    const each_array = ensure_array_like(messages);
    $$payload.out.push(`<!--[-->`);
    for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
      let msg = each_array[$$index_1];
      $$payload.out.push(`<div${attr_class(`message-wrapper ${stringify(msg.authorRole === "admin" ? "received" : "sent")}`, "svelte-10q3qfh")}>`);
      if (msg.authorRole === "admin") {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<div class="message-avatar svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">admin_panel_settings</span></div>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--> <div class="message-bubble svelte-10q3qfh"><div class="message-header svelte-10q3qfh"><span class="message-author svelte-10q3qfh">${escape_html(msg.author)}</span> <span class="message-time svelte-10q3qfh">${escape_html(new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</span></div> `);
      if (msg.text) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<div class="student-document-request-message-text">${escape_html(msg.text)}</div>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--> `);
      if (msg.attachments && msg.attachments.length > 0) {
        $$payload.out.push("<!--[-->");
        const each_array_1 = ensure_array_like(msg.attachments);
        $$payload.out.push(`<div class="message-attachments svelte-10q3qfh"><!--[-->`);
        for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
          let attachment = each_array_1[$$index];
          $$payload.out.push(`<button class="attachment-item svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">attach_file</span> <div class="attachment-info svelte-10q3qfh"><span class="attachment-name svelte-10q3qfh">${escape_html(attachment.name)}</span> <span class="attachment-size svelte-10q3qfh">${escape_html((attachment.size / 1024).toFixed(1))} KB</span></div> <span class="material-symbols-outlined svelte-10q3qfh">download</span></button>`);
        }
        $$payload.out.push(`<!--]--></div>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--></div></div>`);
    }
    $$payload.out.push(`<!--]-->`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<div class="no-chat svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">chat_bubble_outline</span> <p class="svelte-10q3qfh">No messages yet</p> <p class="subtitle svelte-10q3qfh">Start a conversation with the admin</p></div>`);
  }
  $$payload.out.push(`<!--]--></div> <div class="student-chat-input-wrapper svelte-10q3qfh">`);
  if (selectedFiles.length > 0) {
    $$payload.out.push("<!--[-->");
    const each_array_2 = ensure_array_like(selectedFiles);
    $$payload.out.push(`<div class="selected-files-preview svelte-10q3qfh"><!--[-->`);
    for (let index = 0, $$length = each_array_2.length; index < $$length; index++) {
      let file = each_array_2[index];
      $$payload.out.push(`<div class="file-preview-item svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">description</span> <span class="file-preview-name svelte-10q3qfh">${escape_html(file.name)}</span> <span class="file-preview-size svelte-10q3qfh">(${escape_html((file.size / 1024).toFixed(1))} KB)</span> <button class="remove-file-btn svelte-10q3qfh" title="Remove file"><span class="material-symbols-outlined svelte-10q3qfh">close</span></button></div>`);
    }
    $$payload.out.push(`<!--]--></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <div${attr_class("student-chat-input svelte-10q3qfh", void 0, { "disabled": isChatDisabled })}>`);
  if (isChatDisabled) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="chat-disabled-notice svelte-10q3qfh"><span class="material-symbols-outlined svelte-10q3qfh">block</span> <span>Chat is disabled for ${escape_html(selectedRequest.status === "released" ? "released" : "cancelled")} requests</span></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" style="display: none;" class="svelte-10q3qfh"/> <button class="attach-btn svelte-10q3qfh" title="Attach file" aria-label="Attach file"><span class="material-symbols-outlined svelte-10q3qfh">attach_file</span></button> <input placeholder="Type your message..." aria-label="Message input"${attr("value", newMessage)}${attr("disabled", isSendingMessage, true)} class="svelte-10q3qfh"/> <button class="send-btn svelte-10q3qfh" title="Send message" aria-label="Send message"${attr("disabled", !newMessage.trim() && selectedFiles.length === 0, true)}><span class="material-symbols-outlined svelte-10q3qfh">send</span></button>`);
  }
  $$payload.out.push(`<!--]--></div></div></div></div></div> <div class="mobile-pagination-controls svelte-10q3qfh"><div class="pagination-dots svelte-10q3qfh"><button${attr_class("pagination-dot svelte-10q3qfh", void 0, { "active": currentPage === 1 })} aria-label="Go to request details"><span class="material-symbols-outlined svelte-10q3qfh">description</span></button> <button${attr_class("pagination-dot svelte-10q3qfh", void 0, { "active": currentPage === 2 })} aria-label="Go to chat"><span class="material-symbols-outlined svelte-10q3qfh">forum</span></button></div></div></div> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]-->`);
  pop();
}
function StudentDocumentRequestModalContainer($$payload, $$props) {
  push();
  let modalState = {
    isOpen: false,
    request: null,
    onCancel: null,
    onRefresh: null
  };
  studentDocReqModalStore.subscribe((value) => {
    modalState = value;
  });
  let visible = false;
  let closing = false;
  if (modalState.isOpen || visible || closing) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div${attr_class("student-docreq-modal-overlay svelte-1ingzcd", void 0, {
      "student-docreq-modal-visible": visible,
      "student-docreq-modal-closing": closing
    })} role="dialog" aria-modal="true" tabindex="-1">`);
    StudentDocumentRequestModal($$payload, {
      request: modalState.request,
      onCancel: modalState.onCancel,
      onRefresh: modalState.onRefresh
    });
    $$payload.out.push(`<!----></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]-->`);
  pop();
}
function _layout($$payload, $$props) {
  push();
  let { children } = $$props;
  let currentFavicon = favicon;
  head($$payload, ($$payload2) => {
    $$payload2.out.push(`<link rel="icon"${attr("href", currentFavicon)}/> <link rel="preconnect" href="https://fonts.googleapis.com"/> <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/> <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&amp;display=swap" rel="stylesheet"/> <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"/> <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/> <meta name="theme-color" content="#1565c0"/>`);
  });
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> `);
  ToastContainer($$payload);
  $$payload.out.push(`<!----> `);
  ModalContainer($$payload);
  $$payload.out.push(`<!----> `);
  AdminDocumentRequestModalContainer($$payload);
  $$payload.out.push(`<!----> `);
  StudentDocumentRequestModalContainer($$payload);
  $$payload.out.push(`<!---->`);
  pop();
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte-Ct8P3Aqc.js.map
