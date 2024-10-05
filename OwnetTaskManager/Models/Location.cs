using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.Models;

public class Location
{
    [Key]
    public int Id { get; set; }
    public string Address { get; set; }
    
    // Relación con la empresa propietaria de esta ubicacion
    public int CompanyId { get; set; }  // Clave foránea, indica a qué empresa pertenece
    public Company Company { get; set; } // Referencia a la entidad Company
    
    // Relación con las tareas que se han realizado en esta ubicación
    public ICollection<TaskItem> TaskItems { get; set; } // Colección de tareas realizadas en esta ubicación
}
