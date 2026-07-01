import 'dart:io';
import 'package:flutter/material.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/api_service.dart';
import '../models/recording.dart';

class RecordScreen extends StatefulWidget {
  const RecordScreen({super.key});
  @override
  State<RecordScreen> createState() => _RecordScreenState();
}

class _RecordScreenState extends State<RecordScreen> {
  final AudioRecorder _recorder = AudioRecorder();
  bool _isRecording = false;
  bool _isUploading = false;
  String? _lastSummary;
  String? _statusMessage;
  String _selectedType = 'memo'; // 'memo' or 'shopping'

  Future<void> _toggleRecord() async {
    final micStatus = await Permission.microphone.request();
    if (!micStatus.isGranted) {
      setState(() => _statusMessage = 'Microphone permission denied');
      return;
    }

    if (_isRecording) {
      final path = await _recorder.stop();
      setState(() { _isRecording = false; });

      if (path != null) {
        if (_selectedType == 'shopping') {
          await _promptClientAndUpload(File(path));
        } else {
          await _uploadFile(File(path), type: 'memo');
        }
      }
    } else {
      final dir = await getTemporaryDirectory();
      final filePath = '${dir.path}/memo_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc, sampleRate: 16000),
        path: filePath,
      );
      setState(() { 
        _isRecording = true; 
        _lastSummary = null;
        _statusMessage = 'Recording (${_selectedType == 'memo' ? 'My Memo' : 'My Shopping'})... Tap to stop'; 
      });
    }
  }

  Future<void> _promptClientAndUpload(File audioFile) async {
    List<ClientModel> clients = [];
    try {
      clients = await ApiService.getClients();
    } catch (_) {}

    bool isAddNew = clients.isEmpty;
    String? selectedClientId = clients.isNotEmpty ? clients.first.id : null;
    String newClientName = '';

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {

            return AlertDialog(
              title: const Text('🛒 Associate Category / Store Name'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Select an existing store/category name or create a new one:'),
                    const SizedBox(height: 16),
                    if (!isAddNew && clients.isNotEmpty) ...[
                      DropdownButtonFormField<String>(
                        decoration: const InputDecoration(labelText: 'Select Name', border: OutlineInputBorder()),
                        value: selectedClientId,
                        items: clients.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                        onChanged: (val) => setModalState(() => selectedClientId = val),
                      ),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: () => setModalState(() => isAddNew = true),
                        child: const Text('+ Add New Category / Store Name'),
                      )
                    ] else ...[
                      TextField(
                        decoration: const InputDecoration(
                          labelText: 'New Category / Store Name',
                          hintText: 'e.g. Pick n Pay, Woolworths, Hardware',
                          border: OutlineInputBorder(),
                        ),
                        onChanged: (val) => newClientName = val,
                      ),
                      if (clients.isNotEmpty)
                        TextButton(
                          onPressed: () => setModalState(() => isAddNew = false),
                          child: const Text('← Choose Existing Name'),
                        )
                    ]
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    Navigator.pop(context, {'save': false});
                  },
                  child: const Text('Cancel'),
                ),
                TextButton(
                  onPressed: () {
                    Navigator.pop(context, {'save': true, 'clientId': null, 'clientName': null});
                  },
                  child: const Text('No Name'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
                  onPressed: () {
                    final String? cName = isAddNew && newClientName.trim().isNotEmpty ? newClientName.trim() : null;
                    final String? cId = !isAddNew ? selectedClientId : null;
                    Navigator.pop(context, {'save': true, 'clientId': cId, 'clientName': cName});
                  },
                  child: const Text('Save Shopping Item'),
                ),
              ],
            );
          },
        );
      },
    );

    if (result == null || result['save'] != true) {
      setState(() {
        _statusMessage = 'Recording cancelled';
      });
      try {
        if (await audioFile.exists()) {
          await audioFile.delete();
        }
      } catch (_) {}
      return;
    }

    await _uploadFile(
      audioFile,
      type: 'shopping',
      clientId: result['clientId'],
      clientName: result['clientName'],
    );
  }

  Future<void> _uploadFile(File file, {required String type, String? clientId, String? clientName}) async {
    setState(() {
      _isUploading = true;
      _statusMessage = 'Transcribing & processing on computer...';
    });
    try {
      final rec = await ApiService.uploadAudio(
        audioFile: file,
        type: type,
        clientId: clientId,
        clientName: clientName,
      );
      setState(() {
        _isUploading = false;
        _lastSummary = rec.summary;
        _statusMessage = 'Saved! Message Name: "${rec.summary}"';
      });
    } catch (e) {
      setState(() {
        _isUploading = false;
        _statusMessage = 'Error: ${e.toString()}';
      });
    }
  }

  @override
  void dispose() {
    _recorder.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E3A8A),
        elevation: 0,
        title: const Text('🧠 My Memory', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: Center(
        child: SingleChildScrollView(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Type Segment Toggle
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(25),
                ),
                padding: const EdgeInsets.all(4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    GestureDetector(
                      onTap: () => setState(() => _selectedType = 'memo'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                        decoration: BoxDecoration(
                          color: _selectedType == 'memo' ? const Color(0xFF1E3A8A) : Colors.transparent,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '📋 My Memo',
                          style: TextStyle(
                            color: _selectedType == 'memo' ? Colors.white : const Color(0xFF475569),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => setState(() => _selectedType = 'shopping'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                        decoration: BoxDecoration(
                          color: _selectedType == 'shopping' ? const Color(0xFF1E3A8A) : Colors.transparent,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '🛒 My Shopping',
                          style: TextStyle(
                            color: _selectedType == 'shopping' ? Colors.white : const Color(0xFF475569),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),
              GestureDetector(
                onTap: _isUploading ? null : _toggleRecord,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _isRecording
                      ? const Color(0xFFDC2626)
                      : _isUploading
                        ? Colors.grey
                        : const Color(0xFF2563EB),
                    boxShadow: [
                      BoxShadow(
                        color: (_isRecording ? Colors.red : Colors.blue).withOpacity(0.3),
                        blurRadius: 30,
                        spreadRadius: 6,
                      )
                    ],
                  ),
                  child: Icon(
                    _isUploading
                      ? Icons.cloud_upload
                      : _isRecording
                        ? Icons.stop
                        : Icons.mic,
                    size: 72,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              if (_isUploading)
                const CircularProgressIndicator(color: Color(0xFF2563EB)),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  _statusMessage ?? 'Tap microphone to record a ${_selectedType == 'memo' ? 'memo' : 'shopping note'}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 16, color: Color(0xFF475569), fontWeight: FontWeight.w500),
                ),
              ),
              if (_lastSummary != null) ...[
                const SizedBox(height: 28),
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 32),
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF2563EB), width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      )
                    ],
                  ),
                  child: Column(
                    children: [
                      const Text('💡 Message Name', style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      Text(
                        _lastSummary!,
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ]
            ],
          ),
        ),
      ),
    );
  }
}
