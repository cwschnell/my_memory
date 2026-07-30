class ShoppingItemModel {
  final String id;
  final DateTime createdAt;
  final String itemName;
  final String status;
  final String? recordingId;

  ShoppingItemModel({
    required this.id,
    required this.createdAt,
    required this.itemName,
    required this.status,
    this.recordingId,
  });

  factory ShoppingItemModel.fromJson(Map<String, dynamic> json) {
    return ShoppingItemModel(
      id: json['id'] ?? '',
      createdAt: DateTime.parse(json['created_at']),
      itemName: json['item_name'] ?? json['summary'] ?? '',
      status: json['status'] ?? 'active',
      recordingId: json['recording_id'],
    );
  }
}
