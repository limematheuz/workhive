namespace OwnetTaskManager.DTOs.TaskItem;

public class TaskItemUpdateDto
{
    public string Name { get; set; }
    public string Description { get; set; }
    public DateTime Date { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string Status { get; set; }
    public string IsCompleted { get; set; }
    public int UserId { get; set; } // Relación con User
    public string UserName { get; set; } // Nombre del usuario
    public int LocationId { get; set; } // Relación con Location
    public string LocationAddress { get; set; } // Dirección de la ubicación
    public int CompanyId { get; set; } // Relación con Company
    public string CompanyName { get; set; } // Nombre de la empresa
}