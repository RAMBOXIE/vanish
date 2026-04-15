export class ManualReviewQueue {
  constructor(items = []) {
    this.items = [...items];
  }

  enqueue({ reason, payload, status = 'open', createdAt = new Date().toISOString() }) {
    const item = {
      reason,
      payload,
      createdAt,
      status
    };

    this.items.push(item);
    return item;
  }
}
